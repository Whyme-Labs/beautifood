package app.beautifood.pos

import android.content.Context
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService

/**
 * The Sunmi built-in printer. The till sends the same ESC/POS bytes it sends any receipt printer
 * (an image receipt, a cut, a drawer kick); they go to the printer service as raw data inside a
 * transaction, so the result says whether the paper actually came out. A drawer kick (ESC p) is
 * taken out of the data and done with the service's own openDrawer, which is how Sunmi's
 * drawer port works. On devices without a Sunmi printer, [available] stays false.
 */
class SunmiPrinter(private val context: Context) {
    @Volatile private var service: SunmiPrinterService? = null

    private val callback = object : InnerPrinterCallback() {
        override fun onConnected(s: SunmiPrinterService) {
            service = s
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun bind() {
        try {
            InnerPrinterManager.getInstance().bindService(context, callback)
        } catch (e: InnerPrinterException) {
            Log.i(TAG, "No Sunmi printer service: ${e.message}")
        } catch (e: SecurityException) {
            Log.i(TAG, "Can't bind the Sunmi printer service: ${e.message}")
        }
    }

    fun unbind() {
        try {
            InnerPrinterManager.getInstance().unBindService(context, callback)
        } catch (_: Exception) {
        }
        service = null
    }

    val available: Boolean
        get() = service?.let { s -> runCatching { InnerPrinterManager.getInstance().hasPrinter(s) }.getOrDefault(false) } ?: false

    /** 58 or 80 (mm), as the device reports it. */
    val paperMm: Int
        get() = runCatching { if (service?.printerPaper == 2) 80 else 58 }.getOrDefault(58)

    val model: String
        get() = runCatching { service?.printerModal ?: "" }.getOrDefault("")

    /** 1 is ready; Sunmi's other codes mean out of paper, overheated, cover open and so on. */
    val state: Int
        get() = runCatching { service?.updatePrinterState() ?: 0 }.getOrDefault(0)

    /** Print ESC/POS bytes. `done(ok, error)` is called once, from a binder thread. */
    fun print(data: ByteArray, done: (Boolean, String?) -> Unit) {
        val s = service ?: return done(false, "The built-in printer isn't ready")
        val (bytes, kick) = splitDrawerKick(data)
        try {
            if (bytes.isNotEmpty()) {
                s.enterPrinterBuffer(true)
                s.sendRAWData(bytes, null)
                s.exitPrinterBufferWithCallback(true, object : InnerResultCallback() {
                    override fun onRunResult(isSuccess: Boolean) {}
                    override fun onReturnString(result: String?) {}
                    override fun onRaiseException(code: Int, msg: String?) = done(false, msg ?: "Printer error $code")
                    override fun onPrintResult(code: Int, msg: String?) {
                        if (code == 0) {
                            if (kick) openDrawer()
                            done(true, null)
                        } else {
                            done(false, msg ?: stateMessage(state))
                        }
                    }
                })
            } else {
                if (kick) openDrawer()
                done(true, null)
            }
        } catch (e: Exception) {
            done(false, e.message ?: "Printer error")
        }
    }

    private fun openDrawer() {
        runCatching { service?.openDrawer(null) }
    }

    companion object {
        private const val TAG = "BeautifoodPrinter"

        /** Take every ESC p (drawer kick: 1B 70 m t1 t2) out of the data; say whether there was one. */
        fun splitDrawerKick(data: ByteArray): Pair<ByteArray, Boolean> {
            val out = java.io.ByteArrayOutputStream(data.size)
            var kick = false
            var i = 0
            while (i < data.size) {
                if (i + 4 < data.size && data[i] == 0x1B.toByte() && data[i + 1] == 0x70.toByte()) {
                    kick = true
                    i += 5
                    continue
                }
                out.write(data[i].toInt())
                i++
            }
            return out.toByteArray() to kick
        }

        fun stateMessage(code: Int): String = when (code) {
            1 -> "Ready"
            2 -> "The printer is starting up"
            3 -> "The printer isn't responding"
            4 -> "Out of paper"
            5 -> "The printer is too hot"
            6 -> "The cover is open"
            7 -> "The cutter needs attention"
            505 -> "No printer on this device"
            else -> "Printer error $code"
        }
    }
}
