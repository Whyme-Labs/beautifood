package app.beautifood.pos

import android.os.Build
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * `window.BeautifoodNative`, what the till's page can ask of the device. It answers only while the
 * page is on the app's own Beautifood origin (the WebView never shows other sites, and this
 * checks anyway). Calls that take time answer through `window.__beautifoodNative.done(id, ok, error)`.
 */
class NativeBridge(private val web: WebView, private val printer: SunmiPrinter, private val allowedOrigin: String) {
    @Volatile var currentOrigin: String = ""

    private fun allowed() = currentOrigin == allowedOrigin

    /** What this device has: `{ app, version, device, printer: { available, paper, model, state } }`. */
    @JavascriptInterface
    fun info(): String {
        if (!allowed()) return "{}"
        return JSONObject()
            .put("app", "beautifood-android")
            .put("version", BuildConfig.VERSION_NAME)
            .put("device", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            .put(
                "printer",
                JSONObject()
                    .put("available", printer.available)
                    .put("paper", printer.paperMm)
                    .put("model", printer.model)
                    .put("state", printer.state)
                    .put("status", SunmiPrinter.stateMessage(printer.state)),
            )
            .toString()
    }

    /** Print ESC/POS bytes (base64). Answers `done(id, ok, error)` when the paper is out, or it failed. */
    @JavascriptInterface
    fun write(id: String, base64: String) {
        if (!allowed()) return
        val data = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            return answer(id, false, "Bad data")
        }
        printer.print(data) { ok, error -> answer(id, ok, error) }
    }

    private fun answer(id: String, ok: Boolean, error: String?) {
        val js = "window.__beautifoodNative && window.__beautifoodNative.done(${JSONObject.quote(id)}, $ok, ${if (error == null) "null" else JSONObject.quote(error)})"
        web.post { web.evaluateJavascript(js, null) }
    }

    /** A barcode the device's scanner read, as a `beautifood:scan` event with `detail.code`. */
    fun scanned(code: String) {
        if (!allowed()) return
        val js = "window.dispatchEvent(new CustomEvent('beautifood:scan', { detail: { code: ${JSONObject.quote(code)} } }))"
        web.post { web.evaluateJavascript(js, null) }
    }
}
