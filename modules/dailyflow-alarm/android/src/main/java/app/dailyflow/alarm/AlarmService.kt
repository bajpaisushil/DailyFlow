package app.dailyflow.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Keeps an alarm ringing.
 *
 * A foreground service rather than a plain player, because Android will silence and then kill
 * background audio — which is precisely the failure a person relying on this alarm cannot
 * afford. The service also holds a wake lock, so the CPU does not sleep mid-ring.
 *
 * It always stops itself: after [EXTRA_DURATION_SECONDS], or at [MAX_DURATION_SECONDS] if no
 * duration was given. An alarm that rings forever flattens the battery and is the reason the
 * app gets uninstalled.
 */
class AlarmService : Service() {

  companion object {
    const val ACTION_START = "app.dailyflow.alarm.START"
    const val ACTION_STOP = "app.dailyflow.alarm.STOP"

    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_SOUND_URI = "soundUri"
    const val EXTRA_DURATION_SECONDS = "durationSeconds"
    const val EXTRA_VIBRATE = "vibrate"

    /** Nothing rings longer than this, whatever was asked for. */
    const val MAX_DURATION_SECONDS = 15 * 60

    private const val CHANNEL_ID = "dailyflow-alarm-service"
    private const val NOTIFICATION_ID = 0x0A1A

    @Volatile
    var isRinging: Boolean = false
      private set
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private var stopRunnable: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopEverything()
        return START_NOT_STICKY
      }
      else -> start(intent)
    }
    return START_STICKY
  }

  private fun start(intent: Intent?) {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    val body = intent?.getStringExtra(EXTRA_BODY)
    val soundUri = intent?.getStringExtra(EXTRA_SOUND_URI)
    val vibrate = intent?.getBooleanExtra(EXTRA_VIBRATE, true) ?: true
    val requested = intent?.getIntExtra(EXTRA_DURATION_SECONDS, 60) ?: 60
    val duration = requested.coerceIn(5, MAX_DURATION_SECONDS)

    startForeground(NOTIFICATION_ID, buildNotification(title, body))
    acquireWakeLock(duration)
    startSound(soundUri)
    if (vibrate) startVibration()

    isRinging = true

    // Always stops itself. A ringing alarm nobody silences must not run the battery flat.
    stopRunnable?.let { handler.removeCallbacks(it) }
    val runnable = Runnable { stopEverything() }
    stopRunnable = runnable
    handler.postDelayed(runnable, duration * 1000L)
  }

  private fun buildNotification(title: String, body: String?): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Ringing alarm", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown only while an alarm is actually ringing."
          setSound(null, null)
        },
      )
    }

    val open = Intent(this, AlarmActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pending = PendingIntent.getActivity(
      this, 0, open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body ?: "Tap to stop")
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentIntent(pending)
      .setOngoing(true)
      .build()
  }

  private fun startSound(soundUri: String?) {
    val uri: Uri = when {
      soundUri.isNullOrBlank() ->
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      else -> Uri.parse(soundUri)
    }

    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            // The alarm stream, so it sounds when the phone is set to alarms only.
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@AlarmService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (_: Exception) {
      // A missing or unreadable file must not leave a silent alarm pretending to ring: fall
      // back to the system alarm tone rather than failing quietly.
      if (soundUri != null) startSound(null)
    }
  }

  private fun startVibration() {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    vibrator = v

    val pattern = longArrayOf(0, 600, 400, 600, 400)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(pattern, 0)
    }
  }

  private fun acquireWakeLock(durationSeconds: Int) {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DailyFlow:alarm").apply {
      setReferenceCounted(false)
      // Timeout as a backstop: a leaked wake lock is a flat battery.
      acquire(durationSeconds * 1000L + 5_000L)
    }
  }

  private fun stopEverything() {
    isRinging = false
    stopRunnable?.let { handler.removeCallbacks(it) }
    stopRunnable = null

    try { player?.stop() } catch (_: Exception) {}
    try { player?.release() } catch (_: Exception) {}
    player = null

    try { vibrator?.cancel() } catch (_: Exception) {}
    vibrator = null

    try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    wakeLock = null

    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopEverything()
    super.onDestroy()
  }
}
