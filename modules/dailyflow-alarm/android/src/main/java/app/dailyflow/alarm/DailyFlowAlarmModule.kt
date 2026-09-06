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

    Function("stop") {
      context.startService(
        Intent(context, AlarmService::class.java).apply { action = AlarmService.ACTION_STOP },
      )
      true
    }
  }
}
