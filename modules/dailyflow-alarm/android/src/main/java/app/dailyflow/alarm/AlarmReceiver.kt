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
    private const val CHANNEL_ID = "dailyflow-fullscreen-alarm"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_FIRE) return

    val title = intent.getStringExtra(AlarmService.EXTRA_TITLE) ?: "Alarm"
    val body = intent.getStringExtra(AlarmService.EXTRA_BODY)
    val soundUri = intent.getStringExtra(AlarmService.EXTRA_SOUND_URI)
    val duration = intent.getIntExtra(AlarmService.EXTRA_DURATION_SECONDS, 60)
    val vibrate = intent.getBooleanExtra(AlarmService.EXTRA_VIBRATE, true)

    // Start the sound first: it is what actually wakes someone, and it must not wait on the
    // window manager deciding whether the activity may appear.
    val service = Intent(context, AlarmService::class.java).apply {
      action = AlarmService.ACTION_START
      putExtra(AlarmService.EXTRA_TITLE, title)
      putExtra(AlarmService.EXTRA_BODY, body)
      putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
      putExtra(AlarmService.EXTRA_DURATION_SECONDS, duration)
      putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(service)
    } else {
      context.startService(service)
    }

    postFullScreenNotification(context, title, body)
  }

  /**
   * A high-importance notification whose full-screen intent is the alarm screen.
   *
   * Android shows the activity directly when the device is locked, and a heads-up notification
   * when it is in use — which is the correct behaviour either way. Where the full-screen
   * permission has been withheld (Android 14+ grants it only to apps the user marks as alarms)
   * it degrades to the heads-up form, and the sound still plays.
   */
  private fun postFullScreenNotification(context: Context, title: String, body: String?) {
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

    manager.notify(
      0x0A1B,
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
