package app.dailyflow.alarm

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * The alarm screen.
 *
 * Deliberately built in code rather than as a layout resource: it must render even if the
 * React Native bundle never loads — the phone could be asleep, low on memory, or mid-update —
 * and an alarm that fails to appear because JavaScript did not start is worse than no alarm.
 *
 * The flags below are what make it show over the lock screen and turn the display on. Without
 * them this is just an activity nobody sees, which is the entire difference between an alarm
 * and a notification.
 */
class AlarmActivity : AppCompatActivity() {

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
  }

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
  }

  private fun buildView(): View {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    val body = intent?.getStringExtra(EXTRA_BODY)

    val density = resources.displayMetrics.density
    fun dp(value: Int) = (value * density).toInt()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      // The app's own accent, so the screen is recognisably DailyFlow when it wakes someone
      // at 3am and they have half a second to understand what is happening.
      setBackgroundColor(Color.parseColor("#4158CC"))
      setPadding(dp(28), dp(28), dp(28), dp(28))
    }

    root.addView(TextView(this).apply {
      text = title
      textSize = 34f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    })

    if (!body.isNullOrBlank()) {
      root.addView(TextView(this).apply {
        text = body
        textSize = 18f
        setTextColor(Color.parseColor("#DCE2FF"))
        gravity = Gravity.CENTER
        setPadding(0, dp(12), 0, 0)
      })
    }

    // One very large button and nothing else. Someone half-awake should not have to read,
    // aim, or choose.
    root.addView(Button(this).apply {
      text = "Stop"
      textSize = 22f
      setPadding(dp(48), dp(20), dp(48), dp(20))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(88),
      ).apply { topMargin = dp(48) }
      setOnClickListener { stopAlarm() }
    })

    return root
  }

  private fun stopAlarm() {
    startService(Intent(this, AlarmService::class.java).apply { action = AlarmService.ACTION_STOP })
    finish()
  }

  /**
   * Back does NOT dismiss the alarm; it only leaves the screen, and the sound keeps going.
   * A reflexive back-press at 3am must not be able to silence something the user set
   * precisely because they could not afford to miss it — stopping is a deliberate act.
   */
  @Deprecated("Deprecated in Java")
  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }
}
