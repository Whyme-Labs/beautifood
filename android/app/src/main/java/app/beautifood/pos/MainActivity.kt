package app.beautifood.pos

import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * The till on a Sunmi handheld or desktop terminal: Beautifood's staff console full screen, with
 * the built-in printer and scanner reachable from the page. Links to other sites open in the
 * browser, never in here.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var printer: SunmiPrinter
    private lateinit var bridge: NativeBridge
    private val origin = Uri.parse(BuildConfig.APP_URL).let { "${it.scheme}://${it.authority}" }

    /** Sunmi's scanner (V2 Pro, P2…) broadcasts what it reads. */
    private val scans = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            i.getStringExtra("data")?.takeIf { it.isNotBlank() }?.let { bridge.scanned(it.trim()) }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        printer = SunmiPrinter(applicationContext).also { it.bind() }

        web = WebView(this)
        setContentView(web)
        CookieManager.getInstance().setAcceptCookie(true)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString BeautifoodPOS/${BuildConfig.VERSION_NAME}"
        }
        bridge = NativeBridge(web, printer, origin)
        web.addJavascriptInterface(bridge, "BeautifoodNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if ("${u.scheme}://${u.authority}" == origin) return false
                // receipts' tel:, maps and anything else go to the system
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                val u = Uri.parse(url)
                bridge.currentOrigin = "${u.scheme}://${u.authority}"
            }
        }

        val filter = IntentFilter("com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED")
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(scans, filter, Context.RECEIVER_EXPORTED) else registerReceiver(scans, filter)

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(BuildConfig.APP_URL + BuildConfig.START_PATH)
        hideSystemBars()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Deprecated("Back goes back in the page first")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(scans) }
        printer.unbind()
        web.destroy()
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        // a till is a till: full screen, bars come back with a swipe
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
}
