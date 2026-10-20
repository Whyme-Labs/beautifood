package app.beautifood.pos

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SunmiPrinterTest {
    private fun bytes(vararg b: Int) = ByteArray(b.size) { b[it].toByte() }

    @Test
    fun drawerKickIsTakenOutAndReported() {
        // ESC @, "Hi", ESC p 0 25 250 (the till's drawer kick), GS V 1 (cut)
        val data = bytes(0x1B, 0x40, 0x48, 0x69, 0x1B, 0x70, 0x00, 25, 250, 0x1D, 0x56, 0x01)
        val (out, kick) = SunmiPrinter.splitDrawerKick(data)
        assertTrue(kick)
        assertArrayEquals(bytes(0x1B, 0x40, 0x48, 0x69, 0x1D, 0x56, 0x01), out)
    }

    @Test
    fun dataWithoutAKickIsUntouched() {
        val data = bytes(0x1B, 0x40, 0x1D, 0x76, 0x30, 0x00, 0x30, 0x00, 0x01, 0x00, 0xFF, 0x1B, 0x70)
        val (out, kick) = SunmiPrinter.splitDrawerKick(data)
        assertFalse(kick) // a trailing, incomplete ESC p is image data, not a command
        assertArrayEquals(data, out)
    }

    @Test
    fun stateCodesReadAsWords() {
        assertEquals("Out of paper", SunmiPrinter.stateMessage(4))
        assertEquals("Printer error 99", SunmiPrinter.stateMessage(99))
    }
}
