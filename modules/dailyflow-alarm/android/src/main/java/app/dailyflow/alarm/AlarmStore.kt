package app.dailyflow.alarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * A native record of every alarm handed to AlarmManager.
 *
 * It exists so alarms can be put back after a reboot WITHOUT starting JavaScript. Android
 * clears the AlarmManager table on restart, and the only thing that re-armed them was the app's
 * JS boot — which runs when the user next opens DailyFlow, not when the phone starts. A phone
 * that restarted overnight lost every alarm silently, while the reminder still showed as set.
 *
 * The app's own database cannot serve this: it is SQLite reached through the JS runtime, and
 * the whole point is to work before that runtime exists. SharedPreferences is readable from a
 * broadcast receiver in a few milliseconds, which is all a boot receiver is given.
 */
object AlarmStore {

  private const val PREFS = "dailyflow-alarm"
  private const val KEY = "scheduled"

  data class Entry(
    val id: String,
    val at: Long,
    val title: String,
    val body: String?,
    val soundUri: String?,
    val durationSeconds: Int,
    val vibrate: Boolean,
    val style: String,
  )

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun all(context: Context): List<Entry> {
    val out = mutableListOf<Entry>()
    try {
      val raw = prefs(context).getString(KEY, null) ?: return out
      val array = JSONArray(raw)
      for (i in 0 until array.length()) {
        val o = array.optJSONObject(i) ?: continue
        val id = o.optString("id").takeIf { it.isNotEmpty() } ?: continue
        out.add(
          Entry(
            id = id,
            at = o.optLong("at"),
            title = o.optString("title", "Alarm"),
            body = o.optString("body").takeIf { it.isNotEmpty() },
            soundUri = o.optString("soundUri").takeIf { it.isNotEmpty() },
            durationSeconds = o.optInt("durationSeconds", 60),
            vibrate = o.optBoolean("vibrate", true),
            style = o.optString("style", AlarmService.STYLE_ALARM),
          ),
        )
      }
    } catch (_: Exception) {
      // A corrupt record is not worth crashing a boot receiver over.
    }
    return out
  }

  private fun write(context: Context, entries: List<Entry>) {
    try {
      val array = JSONArray()
      for (e in entries) {
        array.put(
          JSONObject()
            .put("id", e.id)
            .put("at", e.at)
            .put("title", e.title)
            .put("body", e.body ?: "")
            .put("soundUri", e.soundUri ?: "")
            .put("durationSeconds", e.durationSeconds)
            .put("vibrate", e.vibrate)
            .put("style", e.style),
        )
      }
      prefs(context).edit().putString(KEY, array.toString()).apply()
    } catch (_: Exception) {
      // Losing the mirror costs reboot-resilience, not correctness while running.
    }
  }

  /** Record one alarm, replacing any earlier record with the same id. */
  fun put(context: Context, entry: Entry) {
    val kept = all(context).filter { it.id != entry.id && it.at > System.currentTimeMillis() }
    write(context, kept + entry)
  }

  fun remove(context: Context, id: String) {
    write(context, all(context).filter { it.id != id })
  }

  fun clear(context: Context) {
    write(context, emptyList())
  }
}
