package app.dailyflow.alarm

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The JavaScript bridge to the alarm.
 *
 * Deliberately small: everything that must survive the app being killed lives in the service
 * and the activity, not here. This only starts and stops them, and reports whether the OS
 * will actually let a full-screen alarm appear — which the UI needs in order to tell the
 * truth rather than promise a screen that will never show.
 */
class DailyFlowAlarmModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No React context" }

  /**
   * The pending intent for one alarm.
   *
   * The request code is derived from the id so cancelling and rescheduling address the SAME
   * alarm — two pending intents differing only in their extras are considered equal by
   * Android, so without a distinct request code every alarm would overwrite the last.
   */
  private fun pendingFor(
    id: String,
    title: String,
    body: String?,
    soundUri: String?,
    durationSeconds: Int,
    vibrate: Boolean,
  ): android.app.PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmReceiver.ACTION_FIRE
      putExtra(AlarmService.EXTRA_TITLE, title)
      putExtra(AlarmService.EXTRA_BODY, body)
      putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
      putExtra(AlarmService.EXTRA_DURATION_SECONDS, durationSeconds)
      putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
    }
    return android.app.PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
    )
  }

  override fun definition() = ModuleDefinition {
    Name("DailyFlowAlarm")

    /**
     * Whether a full-screen alarm can actually appear.
     *
     * From Android 14 the full-screen-intent permission is granted only to apps the user
     * classifies as alarms or calls; without it the alarm degrades to a heads-up notification.
     * The UI asks this so it can say so, rather than claiming a screen it cannot show.
     */
    Function("canShowFullScreen") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function true
      val manager = context.getSystemService(android.app.NotificationManager::class.java)
      manager?.canUseFullScreenIntent() ?: false
    }

    /** Opens the settings page where the user can grant it. */
    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function false
      val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = android.net.Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    }

    Function("isRinging") { AlarmService.isRinging }

    /**
     * Ring now. Starts the sound first and then the screen, so audio begins even if the
     * activity is delayed — the sound is what actually wakes someone.
     */
    Function("ring") { title: String, body: String?, soundUri: String?, durationSeconds: Int, vibrate: Boolean ->
      val service = Intent(context, AlarmService::class.java).apply {
        action = AlarmService.ACTION_START
        putExtra(AlarmService.EXTRA_TITLE, title)
        putExtra(AlarmService.EXTRA_BODY, body)
        putExtra(AlarmService.EXTRA_SOUND_URI, soundUri)
        putExtra(AlarmService.EXTRA_DURATION_SECONDS, durationSeconds)
        putExtra(AlarmService.EXTRA_VIBRATE, vibrate)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(service)
      } else {
        context.startService(service)
      }

      context.startActivity(
        Intent(context, AlarmActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          putExtra(AlarmActivity.EXTRA_TITLE, title)
          putExtra(AlarmActivity.EXTRA_BODY, body)
        },
      )
      true
    }

    /**
     * Schedule an alarm for a wall-clock time.
     *
     * This is what makes a TIMED alarm ring rather than merely notify. A scheduled alarm
     * cannot run through JavaScript: when the moment arrives DailyFlow is normally not
     * running, so nothing in JS exists to ring anything. AlarmManager wakes a broadcast
     * receiver directly instead.
     *
     * setAlarmClock is used deliberately over setExact: it is the only variant Android treats
     * as a user-visible alarm, so it survives Doze and battery optimisation — the two things
     * that silently kill everything else on the phones this app is most likely to run on.
     */
    Function("schedule") { id: String, triggerAtMs: Double, title: String, body: String?, soundUri: String?, durationSeconds: Int, vibrate: Boolean ->
      val manager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager

      // From Android 12 an exact alarm needs permission; without it, fall back to an inexact
      // one rather than throwing, and report so the UI can be honest about the difference.
      val canBeExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        manager.canScheduleExactAlarms()
      } else {
        true
      }

      val pending = pendingFor(id, title, body, soundUri, durationSeconds, vibrate)

      if (canBeExact) {
        manager.setAlarmClock(
          android.app.AlarmManager.AlarmClockInfo(triggerAtMs.toLong(), pending),
          pending,
        )
      } else {
        manager.setAndAllowWhileIdle(
          android.app.AlarmManager.RTC_WAKEUP,
          triggerAtMs.toLong(),
          pending,
        )
      }
      canBeExact
    }

    /** Cancel one scheduled alarm. Cheap, and safe if it was never scheduled. */
    Function("cancelScheduled") { id: String ->
      val manager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
      manager.cancel(pendingFor(id, "", null, null, 60, true))
      true
    }

    /** Whether exact alarms are permitted, so the UI can say what will actually happen. */
    Function("canScheduleExact") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val manager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
      manager.canScheduleExactAlarms()
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      context.startActivity(
        Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = android.net.Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
      )
      true
    }

    Function("stop") {
      context.startService(
        Intent(context, AlarmService::class.java).apply { action = AlarmService.ACTION_STOP },
      )
      true
    }
  }
}
