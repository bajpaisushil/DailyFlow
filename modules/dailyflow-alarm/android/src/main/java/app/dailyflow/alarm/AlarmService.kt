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

    /**
     * "alarm" takes over the screen and loops until stopped. "sound" plays the user's own
     * audio ONCE and leaves an ordinary notification behind.
     *
     * The second mode exists because Android will not let an app choose a notification's
     * sound from a file the user picked: a notification channel reads its sound from the
     * app's compiled-in resources, and its sound can never be changed after the channel is
     * created. So a chosen file could only ever be replaced by the phone's default. Playing
     * it ourselves, woken by the same AlarmManager the alarms use, is the only way the file
     * the user chose is the sound they actually hear.
     */
    const val EXTRA_STYLE = "style"
    const val STYLE_ALARM = "alarm"
    const val STYLE_SOUND = "sound"

    /** The reminder's own notification, in sound mode. Distinct from the alarm's. */
    private const val SOUND_CHANNEL_ID = "dailyflow-own-sound"
    private const val SOUND_NOTIFICATION_ID = 0x0A1C

    /** Nothing rings longer than this, whatever was asked for. */
    const val MAX_DURATION_SECONDS = 15 * 60

    private const val CHANNEL_ID = "dailyflow-alarm-service"
    private const val NOTIFICATION_ID = 0x0A1A

    /** AlarmReceiver's full-screen notification. Cleared when the alarm is silenced. */
    const val FULL_SCREEN_NOTIFICATION_ID = 0x0A1B

    @Volatile
    var isRinging: Boolean = false
      private set

    /**
     * The running service, if there is one.
     *
     * Held so an alarm can be silenced by calling it DIRECTLY rather than by starting a
     * service with ACTION_STOP. Starting a service is precisely what Android forbids an app in
     * the background from doing — and someone tapping Stop in the notification shade is always
     * in the background. Routing the stop through startService meant the stop could be refused
     * at exactly the moment it was needed.
     */
    @Volatile
    private var instance: AlarmService? = null

    /** Broadcast when ringing ends, so the alarm screen can close itself. */
    const val ACTION_STOPPED = "app.dailyflow.alarm.STOPPED"

    /**
     * Silence whatever is ringing, from any state, foreground or background.
     *
     * Never throws: this is the last line of defence between a user and an alarm they cannot
     * turn off, and it must not be the thing that fails.
     */
    fun stopNow(context: Context) {
      val live = instance
      if (live != null) {
        try {
          live.stopEverything()
          return
        } catch (_: Exception) {
          // Fall through and try the Intent route rather than leave it ringing.
        }
      }
      try {
        context.startService(
          Intent(context, AlarmService::class.java).apply { action = ACTION_STOP },
        )
      } catch (_: Exception) {
        // Nothing is running, or the start was refused. Either way there is nothing left to do.
      }
      // Clear anything the alarm left in the shade, so a silenced alarm does not look live.
      try {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
        manager.cancel(FULL_SCREEN_NOTIFICATION_ID)
      } catch (_: Exception) {
      }
    }

    /**
     * Told whenever ringing starts or stops, so the app can show a Stop button while it is
     * open. Callbacks rather than a poll: asking a native module a question every second, for
     * the rare seconds an alarm is actually ringing, is the kind of cost this app avoids.
     */
    private val ringingListeners = mutableListOf<(Boolean) -> Unit>()

    fun addRingingListener(listener: (Boolean) -> Unit) {
      synchronized(ringingListeners) { ringingListeners.add(listener) }
    }

    fun removeRingingListener(listener: (Boolean) -> Unit) {
      synchronized(ringingListeners) { ringingListeners.remove(listener) }
    }

    private fun publishRinging(value: Boolean) {
      val snapshot = synchronized(ringingListeners) { ringingListeners.toList() }
      for (listener in snapshot) {
        try {
          listener(value)
        } catch (_: Exception) {
          // A listener that throws must not stop the alarm from being stopped.
        }
      }
    }
  }

  /**
   * The alarm's player and the reminder-sound player are SEPARATE, and each is released before
   * it is replaced.
   *
   * There was one field. A second firing — two reminders on the same place, which
   * geofence.ts rings in a loop, or two reminders at the same minute — assigned a new
   * MediaPlayer straight over the live one. The first kept looping at alarm volume with
   * nothing referencing it, so every Stop in the app reached only the newest player, and
   * stopSelf() then nulled the service instance so nothing could ever reach the orphan again.
   * Force-stop or reboot was the only way out. That is precisely "it keeps sounding and there
   * is no way to stop it".
   */
  private var alarmPlayer: MediaPlayer? = null
  private var soundPlayer: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())

  /** One timer per kind, so a new firing cannot disarm the other's self-stop. */
  private var alarmStop: Runnable? = null
  private var soundStop: Runnable? = null

  /**
   * An absolute last resort, armed once and never rescheduled.
   *
   * The per-firing timers were shared, so a second firing removed the first's callback and the
   * first could outlive every limit. This one answers "no matter what happened, is anything
   * still making a noise fifteen minutes later?" with a full teardown.
   */
  private var backstop: Runnable? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopEverything()
        return START_NOT_STICKY
      }
      else -> start(intent)
    }
    /**
     * START_NOT_STICKY, deliberately.
     *
     * START_STICKY asks Android to recreate the service after it is killed — with a NULL
     * Intent. That would land in `start(null)`, which falls back to every default: the system
     * alarm tone, the title "Alarm", a fresh 60-second timer. An alarm the user had already
     * silenced could come back by itself, sounding like nothing they set. A missed alarm is
     * bad; one that resurrects with no explanation is worse, and it is the exact shape of "it
     * keeps sounding and I cannot stop it".
     */
    return START_NOT_STICKY
  }

  private fun start(intent: Intent?) {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    val body = intent?.getStringExtra(EXTRA_BODY)
    val soundUri = intent?.getStringExtra(EXTRA_SOUND_URI)
    val vibrate = intent?.getBooleanExtra(EXTRA_VIBRATE, true) ?: true
    val requested = intent?.getIntExtra(EXTRA_DURATION_SECONDS, 60) ?: 60
    val duration = requested.coerceIn(5, MAX_DURATION_SECONDS)
    val incoming = intent?.getStringExtra(EXTRA_STYLE) ?: STYLE_ALARM

    armBackstop()

    when {
      /**
       * A reminder's own sound arriving while an ALARM is ringing must not touch the alarm.
       *
       * It used to take the service over completely: it reassigned the style, called
       * startForeground under a DIFFERENT notification id — which cancels the alarm's
       * Stop-bearing notification — set isRinging to false so the in-app Stop banner
       * disappeared, and then tore the whole service down when its file finished, while the
       * alarm was still audibly looping. The louder, more urgent thing wins; the reminder
       * still arrives, silently, as an ordinary notification.
       */
      incoming == STYLE_SOUND && isRinging -> postReminderBesideAlarm(title, body)

      incoming == STYLE_SOUND -> startOwnSound(title, body, soundUri, duration, vibrate)

      else -> startAlarm(title, body, soundUri, duration, vibrate)
    }
  }

  /** Ring, replacing any ring already in progress rather than layering on top of it. */
  private fun startAlarm(
    title: String,
    body: String?,
    soundUri: String?,
    duration: Int,
    vibrate: Boolean,
  ) {
    // Everything the previous ring owned goes first. Two alarms must never sound at once, and
    // an unreleased player is one nothing can reach.
    releaseAlarmRing()

    startForeground(NOTIFICATION_ID, buildNotification(title, body))
    acquireWakeLock(duration)
    alarmPlayer = openPlayer(soundUri, alarm = true, loop = true, onComplete = null)
    if (vibrate) startVibration(insistent = true)

    isRinging = true
    publishRinging(true)

    val runnable = Runnable { stopEverything() }
    alarmStop = runnable
    handler.postDelayed(runnable, duration * 1000L)
  }

  /** Play a reminder's chosen file once, leaving the reminder in the notification shade. */
  private fun startOwnSound(
    title: String,
    body: String?,
    soundUri: String?,
    duration: Int,
    vibrate: Boolean,
  ) {
    releaseOwnSound()

    /**
     * The SAME foreground notification id as the alarm, deliberately.
     *
     * startForeground with a different id cancels the notification the service was previously
     * showing — which was how a reminder sound could silently remove a ringing alarm's only
     * Stop button from the shade.
     */
    startForeground(NOTIFICATION_ID, buildReminderNotification(title, body))
    acquireWakeLock(duration)
    soundPlayer = openPlayer(soundUri, alarm = false, loop = false) { finishSoundOnly() }
    if (vibrate) startVibration(insistent = false)

    val runnable = Runnable { finishSoundOnly() }
    soundStop = runnable
    handler.postDelayed(runnable, duration * 1000L)
  }

  /**
   * A reminder that arrived mid-alarm: shown, not sounded.
   *
   * Its own notification id, posted through NotificationManager rather than startForeground,
   * so nothing about the running alarm changes.
   */
  private fun postReminderBesideAlarm(title: String, body: String?) {
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
        .notify(SOUND_NOTIFICATION_ID, buildReminderNotification(title, body))
    } catch (_: Exception) {
      // A reminder that cannot be shown must not disturb the alarm that can be heard.
    }
  }

  /** Fifteen minutes after the service first started, nothing is still making a noise. */
  private fun armBackstop() {
    if (backstop != null) return
    val runnable = Runnable { stopEverything() }
    backstop = runnable
    handler.postDelayed(runnable, MAX_DURATION_SECONDS * 1000L)
  }

  /**
   * The notification for sound mode — the reminder itself, not a "playing audio" banner.
   *
   * A foreground service must show something, so it shows the only thing worth showing. Its
   * channel is deliberately SILENT: this service is already playing the sound, and letting the
   * channel add one too is how the user ends up hearing two at once. When playback finishes
   * the notification is DETACHED rather than removed, so it stays in the shade to be read and
   * tapped like any other reminder.
   */
  private fun buildReminderNotification(title: String, body: String?): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          SOUND_CHANNEL_ID,
          "Reminders with your own sound",
          NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Reminders whose sound is a file you chose."
          setSound(null, null)
          enableVibration(false)
        },
      )
    }

    val open = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val pending = open?.let {
      PendingIntent.getActivity(
        this, 1, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    return Notification.Builder(this, SOUND_CHANNEL_ID)
      .setContentTitle(title)
      .apply {
        if (!body.isNullOrBlank()) setContentText(body)
        if (pending != null) setContentIntent(pending)
      }
      .setSmallIcon(applicationInfo.icon)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .build()
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
      // A Stop the user can reach without opening anything. This notification is visible
      // whenever the alarm is sounding, including when the phone is in use and the alarm
      // screen was never shown.
      .addAction(stopAction())
      .build()
  }

  /** The Stop button attached to every notification an alarm puts on screen. */
  private fun stopAction(): Notification.Action {
    val builder = Notification.Action.Builder(
      android.graphics.drawable.Icon.createWithResource(
        this,
        android.R.drawable.ic_menu_close_clear_cancel,
      ),
      "Stop",
      AlarmStopReceiver.pendingIntent(this),
    )
    return builder.build()
  }

  /**
   * Build and start one player. Returns null if even the fallback tone will not open.
   *
   * A factory rather than a method that assigns a field: assigning over a live `player` was
   * the bug that made an alarm unstoppable. The caller owns the reference and is responsible
   * for releasing the previous one first.
   */
  private fun openPlayer(
    soundUri: String?,
    alarm: Boolean,
    loop: Boolean,
    onComplete: (() -> Unit)?,
  ): MediaPlayer? {
    val uri: Uri = when {
      soundUri.isNullOrBlank() ->
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
          ?: return null
      else -> Uri.parse(soundUri)
    }

    try {
      return MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            // An alarm uses the alarm stream, so it sounds when the phone is set to alarms
            // only. A reminder uses the notification stream, so it obeys Do Not Disturb the
            // way the user expects a reminder to.
            .setUsage(
              if (alarm) AudioAttributes.USAGE_ALARM
              else AudioAttributes.USAGE_NOTIFICATION,
            )
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@AlarmService, uri)
        isLooping = loop
        if (onComplete != null) setOnCompletionListener { onComplete() }
        prepare()
        start()
      }
    } catch (_: Exception) {
      /**
       * A missing or unreadable file must not leave a silent alarm pretending to ring. Retry
       * ONCE with the system tone — non-recursive on purpose, because the old recursive
       * fallback re-entered a method that assigned the shared player field and could orphan a
       * live one on the way through.
       */
      if (soundUri == null) return null
      return try {
        MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(
                if (alarm) AudioAttributes.USAGE_ALARM
                else AudioAttributes.USAGE_NOTIFICATION,
              )
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          val fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: return null
          setDataSource(this@AlarmService, fallback)
          isLooping = loop
          if (onComplete != null) setOnCompletionListener { onComplete() }
          prepare()
          start()
        }
      } catch (_: Exception) {
        null
      }
    }
  }

  /** Silence and free one player. Safe on null, safe twice, never throws. */
  private fun release(player: MediaPlayer?) {
    if (player == null) return
    try { player.setOnCompletionListener(null) } catch (_: Exception) {}
    try { player.stop() } catch (_: Exception) {}
    try { player.release() } catch (_: Exception) {}
  }

  /** Everything the current ALARM owns. */
  private fun releaseAlarmRing() {
    alarmStop?.let { handler.removeCallbacks(it) }
    alarmStop = null
    release(alarmPlayer)
    alarmPlayer = null
    try { vibrator?.cancel() } catch (_: Exception) {}
    vibrator = null
    releaseWakeLock()
  }

  /** Everything the current reminder SOUND owns. */
  private fun releaseOwnSound() {
    soundStop?.let { handler.removeCallbacks(it) }
    soundStop = null
    release(soundPlayer)
    soundPlayer = null
  }

  private fun releaseWakeLock() {
    try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    wakeLock = null
  }

  private fun startVibration(insistent: Boolean) {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    vibrator = v

    // An alarm buzzes until it is stopped; a reminder buzzes once. Repeat index 0 means
    // "loop forever", and -1 means "play once" — the difference between the two modes.
    val pattern = if (insistent) longArrayOf(0, 600, 400, 600, 400) else longArrayOf(0, 220, 120, 220)
    val repeat = if (insistent) 0 else -1
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createWaveform(pattern, repeat))
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(pattern, repeat)
    }
  }

  private fun acquireWakeLock(durationSeconds: Int) {
    // Release first: assigning over a held, non-reference-counted lock leaked it.
    releaseWakeLock()
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DailyFlow:alarm").apply {
      setReferenceCounted(false)
      // Timeout as a backstop: a leaked wake lock is a flat battery.
      acquire(durationSeconds * 1000L + 5_000L)
    }
  }

  /**
   * End sound mode once the audio has played through, leaving the notification behind.
   *
   * `STOP_FOREGROUND_DETACH` is the whole point: the service goes away, the reminder stays in
   * the shade. Removing it would mean a reminder that made a noise and then vanished before it
   * could be read.
   *
   * The isRinging guard is not defensive padding. Without it, a reminder sound finishing while
   * an ALARM was ringing called stopSelf() and destroyed the service mid-ring, leaving the
   * alarm's player looping with no service, no notification, and no instance for any Stop to
   * reach.
   */
  private fun finishSoundOnly() {
    releaseOwnSound()
    if (isRinging) return

    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_DETACH)
    stopSelf()
  }

  /**
   * Silence everything this service has ever started, and go away.
   *
   * "Everything" is literal, and it is the fix for "it keeps sounding and there is no way to
   * stop it". This used to reach only the single current player, so a player left behind by a
   * second firing kept looping at alarm volume with nothing able to reach it — not the alarm
   * screen, not the notification, not the app.
   */
  private fun stopEverything() {
    val wasRinging = isRinging
    isRinging = false

    for (runnable in listOfNotNull(alarmStop, soundStop, backstop)) {
      handler.removeCallbacks(runnable)
    }
    alarmStop = null
    soundStop = null
    backstop = null

    release(alarmPlayer)
    alarmPlayer = null
    release(soundPlayer)
    soundPlayer = null

    try { vibrator?.cancel() } catch (_: Exception) {}
    vibrator = null

    releaseWakeLock()

    /**
     * Clear what the alarm put in the shade. The full-screen notification is posted by
     * AlarmReceiver, not by this service, so stopForeground does not touch it — a silenced
     * alarm would otherwise leave a live-looking alarm sitting there.
     */
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.cancel(FULL_SCREEN_NOTIFICATION_ID)
      manager.cancel(SOUND_NOTIFICATION_ID)
    } catch (_: Exception) {
    }

    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()

    if (wasRinging) publishRinging(false)
    // Tells the alarm screen to close, so a silenced alarm does not leave a dead Stop button
    // sitting over the lock screen.
    try {
      sendBroadcast(Intent(ACTION_STOPPED).setPackage(packageName))
    } catch (_: Exception) {
    }
  }

  override fun onDestroy() {
    instance = null
    stopEverything()
    super.onDestroy()
  }
}
