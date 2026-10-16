package com.commu.printeragent

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/** Lets JS check and request the "display over other apps" permission that [BootReceiver] needs. */
class AutoStartModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AutoStart"

  @ReactMethod
  fun isEnabled(promise: Promise) = promise.resolve(Settings.canDrawOverlays(context))

  @ReactMethod
  fun openSettings() {
    context.startActivity(
      Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }
}

class AutoStartPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(AutoStartModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
