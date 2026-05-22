export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const androidCodeFiles: CodeFile[] = [
  {
    name: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    language: "xml",
    description: "App configuration declaring required system permissions, the call receiver, and the foreground protection service.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/apk/res/android"
    package="com.example.bypassdnd">

    <!-- Required Permissions -->
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <!-- Necessary on Android 9+ to get incoming numbers in PHONE_STATE -->
    <uses-permission android:name="android.permission.READ_CALL_LOG" />
    <!-- Required to temporarily adjust volume or turn off do-not-disturb -->
    <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
    <!-- Required to play ringtone / trigger vibration -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <!-- Required to keep protection service running reliably in the background -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <!-- Required on Android 14+ for Foreground Service Types -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <!-- Optional: For flashing the flashlight during incoming calls -->
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- Startup/reboot completion override to auto-enable bypass protection -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ByPassDND">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.ByPassDND">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Foreground Service matching the special use type or phone call monitor -->
        <service
            android:name=".service.DndBypassService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse" />

        <!-- Static Broadcast Receiver for Boot Receiver. Call state is registered dynamically
             in the service to comply with modern Android Oreo+ background execution limits. -->
        <receiver
            android:name=".receiver.BootReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>`
  },
  {
    name: "DndBypassService.kt",
    path: "app/src/main/java/com/example/bypassdnd/service/DndBypassService.kt",
    language: "kotlin",
    description: "Foreground Service that displays a persistent notification, registers the dynamic call interceptor, and ensures persistent background execution.",
    content: `package com.example.bypassdnd.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.bypassdnd.MainActivity
import com.example.bypassdnd.R
import com.example.bypassdnd.receiver.CallReceiver

/**
 * Foreground Service that maintains active DND/Silent bypass coverage.
 * Keeping this active as a Foreground Service prevents Android from reclaiming
 * resources and stopping incoming call checks when the user quits the app.
 */
class DndBypassService : Service() {

    private var callReceiver: CallReceiver? = null
    private val CHANNEL_ID = "bypass_dnd_protection_channel"
    private val NOTIFICATION_ID = 404

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())

        // Register the CallReceiver dynamically to capture incoming calls reliably 
        // on Oreo (Android 8.0, API 26) and higher, where static registration is limited.
        callReceiver = CallReceiver()
        val filter = IntentFilter("android.intent.action.PHONE_STATE")
        registerReceiver(callReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY ensures the system recreates the service if it gets killed.
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        // Safely unregister ringer listener to prevent memory leaks
        callReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Bypass DND Protection Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps BypassDND active in the background to detect emergencies."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BypassDND Protection Active")
            .setContentText("Monitoring priority calls to override Silent & DND modes.")
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
}`
  },
  {
    name: "CallReceiver.kt",
    path: "app/src/main/java/com/example/bypassdnd/receiver/CallReceiver.kt",
    language: "kotlin",
    description: "BroadcastReceiver that intercepts incoming call states, queries local Room database, overrides silent profiles or DND, forces ringing via the alarm stream, and resets ringer states.",
    content: `package com.example.bypassdnd.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Vibrator
import android.os.VibratorManager
import android.telephony.TelephonyManager
import android.util.Log
import com.example.bypassdnd.data.AppDatabase
import com.example.bypassdnd.data.BypassLog
import com.example.bypassdnd.data.PriorityContact
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Date

/**
 * intercepts CALL state changes.
 * When RINGING, queries the local database to verify priority/emergencies,
 * overrides Do Not Disturb & Silent profiles, and plays a high-priority alarm sound.
 */
class CallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BypassDndCallReceiver"
        
        // Static variables to persist configuration across BroadcastReceiver recreations
        private var isOverriding = false
        private var originalRingerMode = -1
        private var originalVolume = -1
        private var ringtonePlayer: Ringtone? = null
        private var vibrator: Vibrator? = null
        
        // Flashlight control variables
        private var isFlashing = false
        private var handler = Handler(Looper.getMainLooper())
        private var flashRunnable: Runnable? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != "android.intent.action.PHONE_STATE") return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        // Retrieve the incoming phone number. On Modern Android, this requires READ_CALL_LOG & READ_PHONE_STATE
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: ""

        Log.d(TAG, "Phone status changed to: $state, Number: $incomingNumber")

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                if (incomingNumber.isNotEmpty()) {
                    checkAndTriggerBypass(context, incomingNumber)
                }
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK, TelephonyManager.EXTRA_STATE_IDLE -> {
                // Restore settings once the user answers, rejects, or hangs up
                restoreAudioSettings(context)
            }
        }
    }

    private fun checkAndTriggerBypass(context: Context, phoneNumber: String) {
        val database = AppDatabase.getDatabase(context)
        val contactDao = database.contactDao()
        val logDao = database.logDao()

        // Background check
        CoroutineScope(Dispatchers.IO).launch {
            val dbContact = contactDao.getContactByPhone(phoneNumber)
            val isPriority = dbContact != null && dbContact.isPriority
            val normalizedNum = normalizePhoneNumber(phoneNumber)

            // Emergency Repeated Call Check: Count calls from database logs in the last 5 minutes
            val fiveMinutesAgo = Date(System.currentTimeMillis() - 5 * 60 * 1000)
            val recentCallsCount = logDao.getRecentCallsCountForNumber(normalizedNum, fiveMinutesAgo)

            val isEmergencyRepeated = recentCallsCount >= 2 // 3rd call will bypass

            // Insert call log
            val logEntry = BypassLog(
                phoneNumber = phoneNumber,
                contactName = dbContact?.name ?: "Unknown Contact",
                timestamp = Date(),
                wasBypassed = isPriority || isEmergencyRepeated,
                reason = when {
                    isPriority -> "Priority Contact Bypass"
                    isEmergencyRepeated -> "Emergency Repeated Call Bypass (\$recentCallsCount calls in 5m)"
                    else -> "No Override (Normal Call Muted)"
                }
            )
            logDao.insertLog(logEntry)

            if (isPriority || isEmergencyRepeated) {
                withContext(Dispatchers.Main) {
                    executeEmergencyBypass(context, phoneNumber, dbContact?.name ?: "Unknown (Emergency)")
                }
            }
        }
    }

    private fun executeEmergencyBypass(context: Context, phoneNumber: String, name: String) {
        if (isOverriding) return
        isOverriding = true

        Log.d(TAG, "CRITICAL: Triggering DND Bypass for call from $name (\$phoneNumber)!")
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // Store original states
        originalRingerMode = audioManager.ringerMode
        originalVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)

        try {
            // Android Bypass Limit Explanation:
            // Since API 23+, users must grant DND access directly via Intent Settings.
            // If granted, we can override DND filters. Otherwise, we play on STREAM_ALARM channel
            // which bypasses silent profiles automatically on most devices.
            
            // Bypass silent mode by switching to STREAM_ALARM/STREAM_RING maximum volume
            audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
            
            val maxAlarmVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarmVolume, AudioManager.FLAG_PLAY_SOUND)

            // Trigger forceful Ringtone playback on Stream Alarm so it plays even if ringer stream is muted
            val alertTone: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)

            ringtonePlayer = RingtoneManager.getRingtone(context, alertTone)?.apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                }
                play()
            }

            // Trigger strong physical vibration
            triggerVibration(context)

            // Optional: Flash flashlight
            startFlashlightStrobe(context)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to bypass audio settings: \${e.message}", e)
        }
    }

    private fun restoreAudioSettings(context: Context) {
        if (!isOverriding) return
        isOverriding = false

        Log.d(TAG, "CALL ENDED: Restoring ringer volume state.")
        stopFlashlightStrobe(context)

        try {
            ringtonePlayer?.let {
                if (it.isPlaying) it.stop()
            }
            ringtonePlayer = null

            vibrator?.cancel()
            vibrator = null

            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            // Restore original volume & ringer profiles
            if (originalVolume != -1) {
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalVolume, 0)
            }
            if (originalRingerMode != -1) {
                audioManager.ringerMode = originalRingerMode
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error restoring original volume profiles: \${e.message}", e)
        } finally {
            originalRingerMode = -1
            originalVolume = -1
        }
    }

    private fun triggerVibration(context: Context) {
        val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator = v

        val pattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(android.os.VibrationEffect.createWaveform(pattern, 1))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(pattern, 1)
        }
    }

    private fun startFlashlightStrobe(context: Context) {
        val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            val cameraId = cameraManager.cameraIdList.firstOrNull() ?: return
            isFlashing = true
            var flashOn = false

            flashRunnable = object : Runnable {
                override fun run() {
                    if (!isFlashing) {
                        // Ensure flash turns off in termination
                        try {
                            cameraManager.setTorchMode(cameraId, false)
                        } catch (e: Exception) {}
                        return
                    }
                    try {
                        flashOn = !flashOn
                        cameraManager.setTorchMode(cameraId, flashOn)
                        handler.postDelayed(this, 150) // Speed of flashlight strobe
                    } catch (e: Exception) {
                        isFlashing = false
                    }
                }
            }
            handler.post(flashRunnable as Runnable)

        } catch (e: Exception) {
            Log.e(TAG, "Camera Flashlight init failure: \${e.message}")
        }
    }

    private fun stopFlashlightStrobe(context: Context) {
        isFlashing = false
        flashRunnable?.let { handler.removeCallbacks(it) }
        flashRunnable = null
    }

    private fun normalizePhoneNumber(phone: String): String {
        return phone.replace("[^0-9+]".toRegex(), "")
    }
}`
  },
  {
    name: "RoomDatabase.kt",
    path: "app/src/main/java/com/example/bypassdnd/data/ContactDatabase.kt",
    language: "kotlin",
    description: "Definition of Room database models (PriorityContact, BypassLog, ContactDao, LogDao, AppDatabase) with queries to match phone numbers and fetch the calling history.",
    content: `package com.example.bypassdnd.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import java.util.Date

// ==========================================
// 1. Entities
// ==========================================

@Entity(tableName = "priority_contacts")
data class PriorityContact(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phoneNumber: String, // Normalized pattern
    val isPriority: Boolean = true,
    val addedTimestamp: Date = Date()
)

@Entity(tableName = "bypass_logs")
data class BypassLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val phoneNumber: String,
    val contactName: String,
    val timestamp: Date,
    val wasBypassed: Boolean,
    val reason: String
)

// ==========================================
// 2. Data Access Objects (DAOs)
// ==========================================

@Dao
interface ContactDao {
    @Query("SELECT * FROM priority_contacts ORDER BY name ASC")
    fun getAllContacts(): kotlinx.coroutines.flow.Flow<List<PriorityContact>>

    @Query("SELECT * FROM priority_contacts WHERE phoneNumber = :phone LIMIT 1")
    suspend fun getContactByPhone(phone: String): PriorityContact?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContact(contact: PriorityContact)

    @Delete
    suspend fun deleteContact(contact: PriorityContact)

    @Query("SELECT COUNT(*) FROM priority_contacts WHERE isPriority = 1")
    fun getPriorityContactsCount(): kotlinx.coroutines.flow.Flow<Int>
}

@Dao
interface LogDao {
    @Query("SELECT * FROM bypass_logs ORDER BY timestamp DESC LIMIT 50")
    fun getAllLogs(): kotlinx.coroutines.flow.Flow<List<BypassLog>>

    @Query("SELECT COUNT(*) FROM bypass_logs WHERE phoneNumber = :phone AND timestamp >= :since")
    suspend fun getRecentCallsCountForNumber(phone: String, since: Date): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: BypassLog)

    @Query("DELETE FROM bypass_logs")
    suspend fun clearLogs()
}

// ==========================================
// 3. Type Converters
// ==========================================

class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }
}

// ==========================================
// 4. Database Holder
// ==========================================

@Database(entities = [PriorityContact::class, BypassLog::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {

    abstract fun contactDao(): ContactDao
    abstract fun logDao(): LogDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "bypass_dnd_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}`
  },
  {
    name: "MainActivity.kt",
    path: "app/src/main/java/com/example/bypassdnd/MainActivity.kt",
    language: "kotlin",
    description: "Jetpack Compose entry point. Visualizes protection state, manages permission requests, shows the list of contacts and historic log, and explains special Android and OEM permissions.",
    content: `package com.example.bypassdnd

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.example.bypassdnd.data.AppDatabase
import com.example.bypassdnd.service.DndBypassService
import com.example.bypassdnd.ui.theme.ByPassDNDTheme

/**
 * MainActivity handles:
 * - Runtime Permissions requests (READ_CONTACTS, READ_PHONE_STATE, READ_CALL_LOG, Camera flash)
 * - Navigation to system settings for DND access (ACCESS_NOTIFICATION_POLICY)
 * - Service triggers
 * - Material 3 Jetpack Compose Dashboard UI.
 */
class MainActivity : ComponentActivity() {

    // Manifest permissions list
    private val requiredPermissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        arrayOf(
            android.Manifest.permission.READ_CONTACTS,
            android.Manifest.permission.READ_PHONE_STATE,
            android.Manifest.permission.READ_CALL_LOG,
            android.Manifest.permission.CAMERA,
            android.Manifest.permission.POST_NOTIFICATIONS
        )
    } else {
        arrayOf(
            android.Manifest.permission.READ_CONTACTS,
            android.Manifest.permission.READ_PHONE_STATE,
            android.Manifest.permission.READ_CALL_LOG,
            android.Manifest.permission.CAMERA
        )
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val grantedAll = results.all { it.value }
        if (grantedAll) {
            Toast.makeText(this, "Permissions granted successfully!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Some permissions were declined. App protection might be hindered.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Setup initial databases on background scope
        val database = AppDatabase.getDatabase(this)

        setContent {
            ByPassDNDTheme {
                var isServiceRunning by remember { mutableStateOf(false) }
                var hasDndPermission by remember { mutableStateOf(checkDndPermission()) }

                // Check service status
                LaunchedEffect(Unit) {
                    isServiceRunning = isDndServiceActive(this@MainActivity)
                }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    // Dashboard composable renders elements corresponding to:
                    // 1. Protection Toggle (Start/Stop Service)
                    // 2. Permission Requests Controls
                    // 3. OEM Troubleshooting Guides
                    // 4. Emergency Contacts list & Logs
                    EmergencyDashboard(
                        isProtected = isServiceRunning,
                        hasDndAccess = hasDndPermission,
                        onRequestPermissions = { requestAppPermissions() },
                        onRequestDndAccess = { requestDndAccessSettings() },
                        onToggleProtection = { shouldEnable ->
                            if (shouldEnable) {
                                if (hasDndPermission || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                                    startProtectionService()
                                    isServiceRunning = true
                                } else {
                                    Toast.makeText(this@MainActivity, "DND Policy Access is required to start protection!", Toast.LENGTH_LONG).show()
                                    requestDndAccessSettings()
                                }
                            } else {
                                stopProtectionService()
                                isServiceRunning = false
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check DND access as user might yield it from Settings and return
        isDndServiceActive(this)
    }

    private fun checkDndPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.isNotificationPolicyAccessGranted
        } else {
            true
        }
    }

    private fun requestAppPermissions() {
        permissionLauncher.launch(requiredPermissions)
    }

    private fun requestDndAccessSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            Toast.makeText(this, "Toggle BypassDND allowance in list.", Toast.LENGTH_LONG).show()
        }
    }

    private fun startProtectionService() {
        val intent = Intent(this, DndBypassService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopProtectionService() {
        val intent = Intent(this, DndBypassService::class.java)
        stopService(intent)
    }

    private fun isDndServiceActive(context: Context): Boolean {
        // Simple mock helper, on actual Android can check system running services list.
        return true
    }
}`
  }
];
