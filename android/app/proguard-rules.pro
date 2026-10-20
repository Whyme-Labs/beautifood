# The page calls these through window.BeautifoodNative.
-keepclassmembers class app.beautifood.pos.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.sunmi.peripheral.printer.** { *; }
