package app.dailyflow.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Receives a scheduled alarm and puts it on screen.
 *
 * This exists because a scheduled alarm cannot go through the app's JavaScript: when the time
 * arrives DailyFlow is usually not running, so nothing in JS is alive to ring anything. The
 * OS wakes this receiver directly.
 *
 * It posts a notification carrying a FULL-SCREEN INTENT, which is the only way an app is
 * allowed to take over the screen. That is precisely what expo-notifications cannot express,
 * and the reason a scheduled "alarm" was previously just a louder banner.
 */
class AlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_FIRE = "app.dailyflow.alarm.FIRE"

    /**
     * Ring this same alarm again in a few minutes.
     *
     * An alarm screen offering only Stop forces a binary on someone who is barely awake: miss
     * it, or commit to being up. Snooze is what people already expect an alarm to do, and
     * without it the honest choice is to press Stop and go back to sleep — which is the same
     * as not having set the alarm.
     *
     * It reuses this receiver, so a snoozed alarm behaves exactly like the original: same
     * sound, same duration, same full screen.
     */
    fun snooze(
      context: Context,
      minutes: Int,
      title: String,
      body: String?,
      soundUri: String?,
      durationSeconds: Int,
      vibrate: Boolean,
    ): Boolean {
      val manager =
        context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager

      val intent = Intent(context, AlarmReceiver::class.java).apply {
        action = ACTION_FIRE
        putExtra(AlarmService.EXTRA_TITLE, title)
        putExtra(AlarmService.EXTRA_BODY, body)
        putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
        putExtra(AlarmService.EXTRA_DURATION_SECONDS, durationSeconds)
        putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
        putExtra(AlarmService.EXTRA_STYLE, AlarmService.STYLE_ALARM)
      }

      val pending = PendingIntent.getBroadcast(
        context,
        SNOOZE_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val at = System.currentTimeMillis() + minutes * 60_000L
      return try {
        val exact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          manager.canScheduleExactAlarms()
        } else {
          true
        }
        if (exact) {
          manager.setAlarmClock(android.app.AlarmManager.AlarmClockInfo(at, pending), pending)
        } else {
          manager.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pending)
        }
        true
      } catch (_: Exception) {
        false
      }
    }

    /** Distinct from every scheduled alarm's code, so a snooze cannot overwrite one. */
    private const val SNOOZE_REQUEST_CODE = 0xB0B

    /**
     * Cancel a pending snooze.
     *
     * A snooze is armed under a fixed request code, so nothing in the app's normal
     * cancel-by-id path could ever name it — it would still ring five minutes later even after
     * the user had erased everything. Only one snooze can be pending at a time, which is what
     * makes a single fixed code safe to cancel outright.
     */
    fun cancelSnooze(context: Context): Boolean = try {
      val manager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
      manager.cancel(
        PendingIntent.getBroadcast(
          context,
          SNOOZE_REQUEST_CODE,
          Intent(context, AlarmReceiver::class.java).setAction(ACTION_FIRE),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        ),
      )
      true
    } catch (_: Exception) {
      false
    }
    private const val CHANNEL_ID = "dailyflow-fullscreen-alarm"
    private const val FALLBACK_CHANNEL_ID = "dailyflow-sound-fallback"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_FIRE) return

    val title = intent.getStringExtra(AlarmService.EXTRA_TITLE) ?: "Alarm"
    val body = intent.getStringExtra(AlarmService.EXTRA_BODY)
    val soundUri = intent.getStringExtra(AlarmService.EXTRA_SOUND_URI)
    val duration = intent.getIntExtra(AlarmService.EXTRA_DURATION_SECONDS, 60)
    val vibrate = intent.getBooleanExtra(AlarmService.EXTRA_VIBRATE, true)
    val style = intent.getStringExtra(AlarmService.EXTRA_STYLE) ?: AlarmService.STYLE_ALARM

    // Start the sound first: it is what actually wakes someone, and it must not wait on the
    // window manager deciding whether the activity may appear.
    val service = Intent(context, AlarmService::class.java).apply {
      action = AlarmService.ACTION_START
      putExtra(AlarmService.EXTRA_TITLE, title)
      putExtra(AlarmService.EXTRA_BODY, body)
      putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
      putExtra(AlarmService.EXTRA_DURATION_SECONDS, duration)
      putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
      putExtra(AlarmService.EXTRA_STYLE, style)
    }
    val started = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(service)
      } else {
        context.startService(service)
      }
      true
    } catch (_: Exception) {
      /**
       * Android may refuse to start a foreground service from the background.
       *
       * An EXACT alarm broadcast is exempt, which is the normal path — but where the user has
       * withheld the exact-alarm permission we fall back to setAndAllowWhileIdle, and that
       * broadcast carries no exemption. On those phones this throws.
       *
       * It matters most in sound mode: the ordinary notification schedule deliberately SKIPS
       * these reminders, so a silent failure here would mean nothing arrived at all. Better a
       * reminder with the wrong sound than no reminder.
       */
      false
    }

    when {
      // Only an alarm takes over the screen. In sound mode the service posts the reminder
      // itself, so posting one here too would show the same thing twice.
      style == AlarmService.STYLE_ALARM ->
        showAlarm(context, title, body, soundUri, duration, vibrate)
      !started -> postPlainNotification(context, title, body)
    }
  }

  /**
   * Put the alarm on screen.
   *
   * Normally through a notification carrying a full-screen intent. But if the user has denied
   * notifications, or switched the alarm channel off, that notification is never shown — and
   * since the Stop button lives on it and on the screen it launches, the alarm would sound
   * with NO control anywhere on the device. So when notifications are off we start the alarm
   * screen directly, which an exact-alarm broadcast is permitted to do.
   */
  private fun showAlarm(
    context: Context,
    title: String,
    body: String?,
    soundUri: String?,
    duration: Int,
    vibrate: Boolean,
  ) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val allowed = try {
      manager.areNotificationsEnabled()
    } catch (_: Exception) {
      true
    }

    if (allowed) {
      postFullScreenNotification(context, title, body, soundUri, duration, vibrate)
      return
    }

    try {
      context.startActivity(
        Intent(context, AlarmActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          putExtra(AlarmActivity.EXTRA_TITLE, title)
          putExtra(AlarmActivity.EXTRA_BODY, body)
          putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
          putExtra(AlarmService.EXTRA_DURATION_SECONDS, duration)
          putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
        },
      )
    } catch (_: Exception) {
      // Nothing more can be done to show it; the service's own duration cap still stops it.
    }
  }

  /**
   * The reminder, as an ordinary notification with the phone's own sound.
   *
   * The last resort for sound mode, used only when the player could not be started. It is not
   * what the user asked for — their chosen file is not what sounds — but it is the reminder,
   * and a reminder that arrives imperfectly beats one that never arrives.
   */
  private fun postPlainNotification(context: Context, title: String, body: String?) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          FALLBACK_CHANNEL_ID,
          "Reminders",
          NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "Reminders DailyFlow could not sound itself." },
      )
    }

    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val pending = open?.let {
      PendingIntent.getActivity(
        context, 2, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      android.app.Notification.Builder(context, FALLBACK_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      android.app.Notification.Builder(context)
    }

    manager.notify(
      0x0A1D,
      builder
        .setContentTitle(title)
        .apply {
          if (!body.isNullOrBlank()) setContentText(body)
          if (pending != null) setContentIntent(pending)
        }
        .setSmallIcon(context.applicationInfo.icon)
        .setAutoCancel(true)
        .build(),
    )
  }

  /**
   * A high-importance notification whose full-screen intent is the alarm screen.
   *
   * Android shows the activity directly when the device is locked, and a heads-up notification
   * when it is in use — which is the correct behaviour either way. Where the full-screen
   * permission has been withheld (Android 14+ grants it only to apps the user marks as alarms)
   * it degrades to the heads-up form, and the sound still plays.
   */
  private fun postFullScreenNotification(
    context: Context,
    title: String,
    body: String?,
    soundUri: String? = null,
    duration: Int = 60,
    vibrate: Boolean = true,
  ) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Alarms that take over the screen."
          // The AlarmService owns the sound; a second one here would play over it.
          setSound(null, null)
          setBypassDnd(true)
        },
      )
    }

    val full = Intent(context, AlarmActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra(AlarmActivity.EXTRA_TITLE, title)
      putExtra(AlarmActivity.EXTRA_BODY, body)
      // Carried so Snooze can recreate this exact alarm rather than a generic one.
      putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
      putExtra(AlarmService.EXTRA_DURATION_SECONDS, duration)
      putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
    }
    val pending = PendingIntent.getActivity(
      context, 1, full,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      android.app.Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      android.app.Notification.Builder(context)
    }

    /**
     * A Stop the user can reach WITHOUT the alarm screen.
     *
     * Android only shows a full-screen intent when the device is locked; the moment someone is
     * holding their phone it degrades to this heads-up notification. Until now its only gesture
     * was "open", so an alarm that went off while the phone was in use had no stop control
     * anywhere on the device.
     */
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      builder.addAction(
        android.app.Notification.Action.Builder(
          android.graphics.drawable.Icon.createWithResource(
            context,
            android.R.drawable.ic_menu_close_clear_cancel,
          ),
          "Stop",
          AlarmStopReceiver.pendingIntent(context),
        ).build(),
      )
    }

    manager.notify(
      AlarmService.FULL_SCREEN_NOTIFICATION_ID,
      builder
        .setContentTitle(title)
        .setContentText(body ?: "Tap to stop")
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setCategory(android.app.Notification.CATEGORY_ALARM)
        .setContentIntent(pending)
        // `true` means: show it full screen even when the device is not locked.
        .setFullScreenIntent(pending, true)
        .setAutoCancel(true)
        .build(),
    )
  }
}
