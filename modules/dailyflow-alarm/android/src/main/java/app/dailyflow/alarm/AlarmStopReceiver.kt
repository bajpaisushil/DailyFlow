package app.dailyflow.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * The one place a ringing alarm is silenced from.
 *
 * It exists because every other route was conditional. The alarm screen's Stop button only
 * helps if that screen is showing, and Android only shows it when the phone is locked — the
 * moment someone is actually holding their phone, a full-screen intent degrades to a heads-up
 * notification whose only gesture is "open". There was no Stop in the notification, and none
 * anywhere in the app. So an alarm that rang while the phone was in use could not be silenced
 * at all.
 *
 * A broadcast is used rather than starting the service with ACTION_STOP because starting a
 * service is exactly the operation Android restricts when an app is in the background — the
 * state someone silencing an alarm from the notification shade is always in.
 */
class AlarmStopReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_STOP = "app.dailyflow.alarm.STOP_NOW"

    /** A PendingIntent that silences the alarm, for a notification action button. */
    fun pendingIntent(context: Context): android.app.PendingIntent =
      android.app.PendingIntent.getBroadcast(
        context,
        0xA1A,
        Intent(context, AlarmStopReceiver::class.java).setAction(ACTION_STOP),
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
      )
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_STOP) return
    AlarmService.stopNow(context)
  }
}
