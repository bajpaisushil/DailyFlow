package app.dailyflow.alarm

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.Date

/**
 * The alarm screen.
 *
 * Deliberately built in code rather than as a layout resource: it must render even if the
 * React Native bundle never loads — the phone could be asleep, low on memory, or mid-update —
 * and an alarm that fails to appear because JavaScript did not start is worse than no alarm.
 * That constraint is why none of the app's own components can be used here, and why the look
 * is reproduced by hand instead.
 *
 * The design answers one question: what does someone half-awake, in the dark, need? A big
 * clock so they know whether to care, the reminder in plain words so they know what it is,
 * and two targets so large they cannot be missed — with Stop and Snooze far enough apart that
 * a fumbled tap cannot silence something they meant to postpone.
 */
class AlarmActivity : AppCompatActivity() {

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    /** Long enough to matter, short enough that nobody sleeps through the second one. */
    private const val SNOOZE_MINUTES = 5

    // The app's own gradient, so this is recognisably DailyFlow at 3am.
    private const val GRADIENT_TOP = "#5B5BD6"
    private const val GRADIENT_BOTTOM = "#8B5CF6"
    private const val ON_GRADIENT_SOFT = "#DCE2FF"
  }

  private val handler = Handler(Looper.getMainLooper())
  private var clock: TextView? = null
  private var tick: Runnable? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    setContentView(buildView())
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    setContentView(buildView())
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager)
        .requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    // Let the gradient run edge to edge behind the system bars rather than stopping at a
    // black strip, which is what made the old screen look like a dialog rather than a moment.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.statusBarColor = Color.TRANSPARENT
      window.navigationBarColor = Color.TRANSPARENT
    }
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  /** A soft, deeply rounded shape — the app's surfaces have no hard corners anywhere. */
  private fun bubble(color: Int, cornerDp: Int): GradientDrawable =
    GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(cornerDp).toFloat()
      setColor(color)
    }

  private fun buildView(): View {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    val body = intent?.getStringExtra(EXTRA_BODY)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.parseColor(GRADIENT_TOP), Color.parseColor(GRADIENT_BOTTOM)),
      )
      setPadding(dp(24), dp(72), dp(24), dp(40))
    }

    // ---- The clock. First thing anyone looks at, so it is the biggest thing on screen. ----
    val time = TextView(this).apply {
      textSize = 76f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      // Thin weight at this size reads as a clock rather than a headline.
      typeface = android.graphics.Typeface.create("sans-serif-light", android.graphics.Typeface.NORMAL)
      letterSpacing = -0.02f
    }
    clock = time
    root.addView(time)

    root.addView(TextView(this).apply {
      text = DateFormat.format("EEEE, d MMMM", Date())
      textSize = 16f
      setTextColor(Color.parseColor(ON_GRADIENT_SOFT))
      gravity = Gravity.CENTER
      alpha = 0.9f
      setPadding(0, dp(6), 0, 0)
    })

    startClock()

    // ---- The reminder, in a soft translucent bubble. ----
    root.addView(
      LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        background = bubble(Color.parseColor("#26FFFFFF"), 32)
        setPadding(dp(24), dp(24), dp(24), dp(24))
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(40) }

        addView(TextView(this@AlarmActivity).apply {
          text = title
          textSize = 30f
          setTextColor(Color.WHITE)
          gravity = Gravity.CENTER
          typeface = android.graphics.Typeface.DEFAULT_BOLD
        })

        if (!body.isNullOrBlank()) {
          addView(TextView(this@AlarmActivity).apply {
            text = body
            textSize = 17f
            setTextColor(Color.parseColor(ON_GRADIENT_SOFT))
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, 0)
          })
        }
      },
    )

    // Pushes the controls to the bottom, where a thumb already is.
    root.addView(View(this), LinearLayout.LayoutParams(0, 0, 1f))

    // ---- Snooze: quieter, and placed ABOVE Stop so a fumbled tap does not silence it. ----
    root.addView(
      softButton(
        label = "Snooze $SNOOZE_MINUTES minutes",
        textColor = Color.WHITE,
        fill = Color.parseColor("#2EFFFFFF"),
        heightDp = 68,
      ).apply {
        setOnClickListener { snooze() }
      },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(68)),
    )

    // ---- Stop: the loudest thing on the screen, and impossible to miss. ----
    root.addView(
      softButton(
        label = "Stop",
        textColor = Color.parseColor(GRADIENT_TOP),
        fill = Color.WHITE,
        heightDp = 88,
      ).apply {
        setOnClickListener { stopAlarm() }
      },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(88)).apply {
        topMargin = dp(14)
      },
    )

    return root
  }

  /**
   * A pill with a centred label.
   *
   * Built from a FrameLayout rather than a Button so it carries no platform styling — the
   * stock button's small ripple, tiny text and hard corners were the reason this screen looked
   * like a system dialog instead of part of DailyFlow.
   */
  private fun softButton(label: String, textColor: Int, fill: Int, heightDp: Int): FrameLayout =
    FrameLayout(this).apply {
      background = bubble(fill, heightDp / 2)
      isClickable = true
      isFocusable = true
      // A visible press state, since there is no ripple on a plain drawable.
      addView(
        TextView(this@AlarmActivity).apply {
          text = label
          textSize = if (heightDp >= 88) 26f else 18f
          setTextColor(textColor)
          gravity = Gravity.CENTER
          typeface = android.graphics.Typeface.DEFAULT_BOLD
        },
        FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.MATCH_PARENT,
        ).apply { gravity = Gravity.CENTER },
      )
      setOnTouchListener { view, event ->
        when (event.action) {
          android.view.MotionEvent.ACTION_DOWN -> view.alpha = 0.7f
          android.view.MotionEvent.ACTION_UP,
          android.view.MotionEvent.ACTION_CANCEL,
          -> view.alpha = 1f
        }
        false
      }
    }

  /** Keeps the clock honest. An alarm screen showing a stale time is unsettling. */
  private fun startClock() {
    tick?.let { handler.removeCallbacks(it) }
    val runnable = object : Runnable {
      override fun run() {
        clock?.text = DateFormat.getTimeFormat(this@AlarmActivity).format(Date())
        handler.postDelayed(this, 10_000L)
      }
    }
    tick = runnable
    runnable.run()
  }

  private fun snooze() {
    val ok = AlarmReceiver.snooze(
      context = this,
      minutes = SNOOZE_MINUTES,
      title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm",
      body = intent?.getStringExtra(EXTRA_BODY),
      soundUri = intent?.getStringExtra(AlarmService.EXTRA_SOUND_URI),
      durationSeconds = intent?.getIntExtra(AlarmService.EXTRA_DURATION_SECONDS, 60) ?: 60,
      vibrate = intent?.getBooleanExtra(AlarmService.EXTRA_VIBRATE, true) ?: true,
    )
    // Silence it either way. Leaving it ringing because the re-arm failed would turn a
    // snooze into the unstoppable alarm this whole screen exists to prevent.
    AlarmService.stopNow(this)
    if (!ok) {
      android.widget.Toast
        .makeText(this, "Could not snooze — alarm stopped", android.widget.Toast.LENGTH_LONG)
        .show()
    }
    finish()
  }

  private fun stopAlarm() {
    // Direct, not via startService: starting a service can be refused, and this is the one
    // action that must never fail.
    AlarmService.stopNow(this)
    finish()
  }

  /**
   * Close when the alarm is silenced from somewhere else — the notification's Stop button, the
   * app, or the duration running out. Otherwise a dead alarm screen stays over the lock screen
   * offering a Stop for something that already stopped.
   */
  private val stopped = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      finish()
    }
  }

  override fun onStart() {
    super.onStart()
    val filter = IntentFilter(AlarmService.ACTION_STOPPED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(stopped, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(stopped, filter)
    }
  }

  override fun onStop() {
    super.onStop()
    try {
      unregisterReceiver(stopped)
    } catch (_: IllegalArgumentException) {
      // Not registered; nothing to undo.
    }
  }

  override fun onDestroy() {
    tick?.let { handler.removeCallbacks(it) }
    tick = null
    super.onDestroy()
  }

  /**
   * Back does NOT dismiss the alarm; it only leaves the screen, and the sound keeps going.
   * A reflexive back-press at 3am must not be able to silence something the user set
   * precisely because they could not afford to miss it — stopping is a deliberate act.
   *
   * This is safe to do only because there is now a Stop in the notification shade and one
   * inside the app. Before those existed, leaving this screen meant losing every way out.
   */
  @Deprecated("Deprecated in Java")
  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }
}
