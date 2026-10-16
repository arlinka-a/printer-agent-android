package com.commu.printeragent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings

/**
 * Reopens the app after the phone restarts. Android blocks activity launches from the background
 * unless the app may draw over other apps, so without that permission this does nothing.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED || !Settings.canDrawOverlays(context)) {
      return
    }
    context.startActivity(
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }
}
