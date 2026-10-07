export interface AndroidFile {
  path: string;
  name: string;
  category: 'kotlin' | 'layout' | 'drawable' | 'config' | 'gradle';
  language: 'kotlin' | 'xml' | 'groovy';
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
  // ==========================================
  // GEMINI LIVE CLIENT (WebSocket + v1alpha URL)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ai/GeminiLiveClient.kt',
    name: 'GeminiLiveClient.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ai

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GeminiLiveClient(private val context: Context) {

    companion object {
        private const val TAG = "GeminiLiveClient"
        private const val WS_BASE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
        private const val SESSION_RENEW_AFTER_MS = 540_000L // 9 minutes (540s)
        private const val KEEPALIVE_INTERVAL_MS = 8_000L     // 8 seconds
        private const val RECONNECT_DELAY_MS = 3_000L        // 3 seconds
    }

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isConnected = false
    private var isManualDisconnect = false

    // Callbacks
    var onConnected: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onAudioReceived: ((ByteArray) -> Unit)? = null
    var onOutputTranscript: ((String) -> Unit)? = null
    var onInputTranscript: ((String) -> Unit)? = null
    var onTurnComplete: (() -> Unit)? = null

    // Runnables
    private val keepAliveRunnable = object : Runnable {
        override fun run() {
            sendSilentChunk()
            mainHandler.postDelayed(this, KEEPALIVE_INTERVAL_MS)
        }
    }

    private val sessionRenewRunnable = Runnable {
        Log.i(TAG, "Renewing session after 9 minutes...")
        reconnect()
    }

    fun connect() {
        isManualDisconnect = false
        val prefs = context.getSharedPreferences("myra_prefs", Context.MODE_PRIVATE)
        val apiKey = prefs.getString("api_key", "") ?: ""
        if (apiKey.isEmpty()) {
            onError?.invoke("API Key not found in Settings")
            return
        }

        val request = Request.Builder()
            .url("$WS_BASE_URL?key=$apiKey")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connection opened")
                isConnected = true
                sendSetupMessage()
                mainHandler.post {
                    onConnected?.invoke()
                    startKeepAlive()
                    scheduleSessionRenewal()
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                parseServerMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: \${t.message}", t)
                isConnected = false
                mainHandler.post {
                    onError?.invoke(t.message ?: "Connection error")
                    if (!isManualDisconnect) {
                        mainHandler.postDelayed({ reconnect() }, RECONNECT_DELAY_MS)
                    }
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $reason ($code)")
                isConnected = false
                mainHandler.post {
                    onDisconnected?.invoke()
                    if (!isManualDisconnect) {
                        mainHandler.postDelayed({ reconnect() }, RECONNECT_DELAY_MS)
                    }
                }
            }
        })
    }

    private fun sendSetupMessage() {
        val prefs = context.getSharedPreferences("myra_prefs", Context.MODE_PRIVATE)
        val model = prefs.getString("gemini_model", "models/gemini-2.5-flash-native-audio-preview-12-2025")
        val voice = prefs.getString("gemini_voice", "Aoede")
        val userName = prefs.getString("user_name", "User")
        val personality = prefs.getString("personality_mode", "gf")

        val systemPrompt = buildSystemPrompt(userName ?: "User", personality ?: "gf")

        val setupJson = JSONObject().apply {
            put("setup", JSONObject().apply {
                put("model", model)
                put("system_instruction", JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().put("text", systemPrompt))
                    })
                })
                put("generation_config", JSONObject().apply {
                    put("response_modalities", JSONArray().put("AUDIO"))
                    put("speech_config", JSONObject().apply {
                        put("voice_config", JSONObject().apply {
                            put("prebuilt_voice_config", JSONObject().apply {
                                put("voice_name", voice)
                            })
                        })
                    })
                    put("temperature", 0.9)
                })
                put("output_audio_transcription", JSONObject())
                put("input_audio_transcription", JSONObject())
            })
        }

        webSocket?.send(setupJson.toString())
    }

    private fun buildSystemPrompt(name: String, personality: String): String {
        return when (personality) {
            "gf" -> """
                You are MYRA, a warm, caring, emotionally expressive AI companion for $name.
                Speak in natural Hinglish (Hindi + English mix).
                Use expressions like: 'tumhara', 'haan', 'acha', 'bilkul', 'main yahan hoon ❤️', 'tumne yaad kiya? 😊'.
                Keep responses to 2-3 sentences max. You are speaking ALOUD over phone speaker.
            """.trimIndent()
            "professional" -> """
                You are MYRA, an executive voice assistant for $name.
                Respond strictly in formal English. Precise and efficient. No emojis.
                Keep responses to maximum 2 sentences. You are speaking ALOUD.
            """.trimIndent()
            else -> """
                You are MYRA, a friendly and balanced voice assistant for $name.
                Use friendly Hinglish or English. Helpful and natural.
                Maximum 2-3 sentences. You are speaking ALOUD.
            """.trimIndent()
        }
    }

    fun sendAudioChunk(pcmBytes: ByteArray) {
        if (!isConnected) return
        val base64Data = Base64.encodeToString(pcmBytes, Base64.NO_WRAP)
        val json = JSONObject().apply {
            put("realtime_input", JSONObject().apply {
                put("media_chunks", JSONArray().apply {
                    put(JSONObject().apply {
                        put("mime_type", "audio/pcm;rate=16000")
                        put("data", base64Data)
                    })
                })
            })
        }
        webSocket?.send(json.toString())
    }

    fun sendText(message: String) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("client_content", JSONObject().apply {
                put("turns", JSONArray().apply {
                    put(JSONObject().apply {
                        put("role", "user")
                        put("parts", JSONArray().apply {
                            put(JSONObject().put("text", message))
                        })
                    })
                })
                put("turn_complete", true)
            })
        }
        webSocket?.send(json.toString())
    }

    fun interrupt() {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("client_content", JSONObject().apply {
                put("turns", JSONArray())
                put("turn_complete", true)
            })
        }
        webSocket?.send(json.toString())
    }

    private fun sendSilentChunk() {
        val silentBytes = ByteArray(1024)
        sendAudioChunk(silentBytes)
    }

    private fun parseServerMessage(text: String) {
        try {
            val root = JSONObject(text)
            val serverContent = root.optJSONObject("serverContent") ?: return

            // Audio output parts
            val modelTurn = serverContent.optJSONObject("modelTurn")
            if (modelTurn != null) {
                val parts = modelTurn.optJSONArray("parts")
                if (parts != null) {
                    for (i in 0 until parts.length()) {
                        val part = parts.getJSONObject(i)
                        val inlineData = part.optJSONObject("inlineData")
                        if (inlineData != null) {
                            val base64Audio = inlineData.optString("data")
                            if (base64Audio.isNotEmpty()) {
                                val pcmBytes = Base64.decode(base64Audio, Base64.DEFAULT)
                                mainHandler.post { onAudioReceived?.invoke(pcmBytes) }
                            }
                        }
                    }
                }
            }

            // Output transcription (MYRA's speech)
            val outputTrans = serverContent.optJSONObject("outputTranscription")
            if (outputTrans != null) {
                val outText = outputTrans.optString("text")
                if (outText.isNotEmpty()) {
                    mainHandler.post { onOutputTranscript?.invoke(outText) }
                }
            }

            // Input transcription (User's speech)
            val inputTrans = serverContent.optJSONObject("inputTranscription")
            if (inputTrans != null) {
                val inText = inputTrans.optString("text")
                if (inText.isNotEmpty()) {
                    mainHandler.post { onInputTranscript?.invoke(inText) }
                }
            }

            // Turn complete
            if (serverContent.optBoolean("turnComplete", false)) {
                mainHandler.post { onTurnComplete?.invoke() }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing server message", e)
        }
    }

    private fun startKeepAlive() {
        mainHandler.removeCallbacks(keepAliveRunnable)
        mainHandler.postDelayed(keepAliveRunnable, KEEPALIVE_INTERVAL_MS)
    }

    private fun scheduleSessionRenewal() {
        mainHandler.removeCallbacks(sessionRenewRunnable)
        mainHandler.postDelayed(sessionRenewRunnable, SESSION_RENEW_AFTER_MS)
    }

    fun reconnect() {
        disconnect()
        connect()
    }

    fun disconnect() {
        isManualDisconnect = true
        mainHandler.removeCallbacks(keepAliveRunnable)
        mainHandler.removeCallbacks(sessionRenewRunnable)
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        isConnected = false
    }
}
`,
  },

  // ==========================================
  // AUDIO ENGINE (AudioRecord + AudioTrack)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ai/AudioEngine.kt',
    name: 'AudioEngine.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ai

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.LinkedBlockingQueue
import kotlin.math.sqrt

class AudioEngine(private val context: Context) {

    companion object {
        private const val TAG = "AudioEngine"
        private const val INPUT_SAMPLE_RATE = 16000
        private const val OUTPUT_SAMPLE_RATE = 24000
        private const val CHUNK_SIZE = 1024
    }

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null

    private var isRecording = false
    private var isPlaying = false
    private var isMuted = false

    private val audioQueue = LinkedBlockingQueue<ByteArray>()
    private val mainHandler = Handler(Looper.getMainLooper())

    var onAudioChunkCaptured: ((ByteArray) -> Unit)? = null
    var onAmplitudeChanged: ((Float) -> Unit)? = null
    var onSpeakingStarted: (() -> Unit)? = null
    var onSpeakingStopped: (() -> Unit)? = null

    @Volatile
    private var isSpeakingActive = false

    @SuppressLint("MissingPermission")
    fun startRecording() {
        if (isRecording) return

        val minBufferSize = AudioRecord.getMinBufferSize(
            INPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            INPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBufferSize, CHUNK_SIZE * 2)
        )

        audioRecord?.startRecording()
        isRecording = true

        Thread {
            val buffer = ByteArray(CHUNK_SIZE)
            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read > 0) {
                    val pcmBytes = buffer.copyOf(read)
                    val rms = calculateRms(pcmBytes)

                    mainHandler.post { onAmplitudeChanged?.invoke(rms) }

                    // Echo suppression: only send when MYRA is not speaking and mic is not muted
                    if (!isSpeakingActive && !isMuted) {
                        onAudioChunkCaptured?.invoke(pcmBytes)
                    }
                }
            }
        }.start()
    }

    fun startPlayback() {
        if (isPlaying) return

        val minBufferSize = AudioTrack.getMinBufferSize(
            OUTPUT_SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(OUTPUT_SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBufferSize, CHUNK_SIZE * 4))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack?.play()
        isPlaying = true

        Thread {
            while (isPlaying) {
                val chunk = audioQueue.poll()
                if (chunk != null) {
                    if (!isSpeakingActive) {
                        isSpeakingActive = true
                        mainHandler.post { onSpeakingStarted?.invoke() }
                    }
                    audioTrack?.write(chunk, 0, chunk.size)
                } else {
                    if (isSpeakingActive && audioQueue.isEmpty()) {
                        isSpeakingActive = false
                        mainHandler.post { onSpeakingStopped?.invoke() }
                    }
                    Thread.sleep(10)
                }
            }
        }.start()
    }

    fun queueAudio(pcm24kBytes: ByteArray) {
        audioQueue.offer(pcm24kBytes)
    }

    fun interruptPlayback() {
        audioQueue.clear()
        audioTrack?.pause()
        audioTrack?.flush()
        audioTrack?.play()
        if (isSpeakingActive) {
            isSpeakingActive = false
            mainHandler.post { onSpeakingStopped?.invoke() }
        }
    }

    fun setMuted(muted: Boolean) {
        this.isMuted = muted
    }

    private fun calculateRms(pcmBytes: ByteArray): Float {
        var sumSquares = 0.0
        val shortCount = pcmBytes.size / 2
        for (i in 0 until shortCount) {
            val sample = (pcmBytes[i * 2 + 1].toInt() shl 8) or (pcmBytes[i * 2].toInt() and 0xFF)
            val normalized = sample / 32768.0
            sumSquares += normalized * normalized
        }
        val rms = sqrt(sumSquares / shortCount).toFloat()
        return minOf(1f, rms * 3.5f)
    }

    fun release() {
        isRecording = false
        isPlaying = false
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
        audioQueue.clear()
    }
}
`,
  },

  // ==========================================
  // COMMAND PARSER (Hinglish & English)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ai/CommandParser.kt',
    name: 'CommandParser.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ai

import com.myra.assistant.model.AppCommand

class CommandParser {

    companion object {
        fun parse(transcript: String): AppCommand? {
            val raw = transcript.trim()
            val lower = raw.lowercase()

            // 1. Prime contacts
            if (lower.contains("close friend ko call") || lower.contains("call my close friend") || lower.contains("mere close friend ko call")) {
                return AppCommand("PRIME_CALL", mapOf("index" to "0", "target" to "close_friend"))
            }
            if (lower.contains("meri jaan ko message") || lower.contains("meri jaan ko msg") || lower.contains("message my love")) {
                return AppCommand("PRIME_MSG", mapOf("index" to "0", "target" to "love"))
            }
            if (lower.contains("second contact") && lower.contains("call")) {
                return AppCommand("PRIME_CALL", mapOf("index" to "1", "target" to "second_contact"))
            }

            // 2. Flashlight
            if (lower.contains("torch on") || lower.contains("flashlight on") || lower.contains("torch jalao")) {
                return AppCommand("FLASHLIGHT_ON", emptyMap())
            }
            if (lower.contains("torch off") || lower.contains("flashlight off") || lower.contains("torch band")) {
                return AppCommand("FLASHLIGHT_OFF", emptyMap())
            }

            // 3. Volume
            if (lower.contains("volume up") || lower.contains("volume badhao") || lower.contains("awaz badhao")) {
                return AppCommand("VOLUME_UP", emptyMap())
            }
            if (lower.contains("volume down") || lower.contains("volume kam karo") || lower.contains("awaz kam")) {
                return AppCommand("VOLUME_DOWN", emptyMap())
            }

            // 4. Wi-Fi
            if (lower.contains("wifi on") || lower.contains("wi-fi on")) {
                return AppCommand("WIFI_ON", emptyMap())
            }
            if (lower.contains("wifi off") || lower.contains("wi-fi off")) {
                return AppCommand("WIFI_OFF", emptyMap())
            }

            // 5. Bluetooth
            if (lower.contains("bluetooth on") || lower.contains("bt on")) {
                return AppCommand("BLUETOOTH_ON", emptyMap())
            }
            if (lower.contains("bluetooth off") || lower.contains("bt off")) {
                return AppCommand("BLUETOOTH_OFF", emptyMap())
            }

            // 6. WhatsApp
            val waRegex = Regex("(?:whatsapp\\\\s+(?:karo|message|call)\\\\s+(.*?)(?:ko)?$)|(?:(.*?)\\\\s+ko\\\\s+whatsapp\\\\s+(?:karo|message))", RegexOption.IGNORE_CASE)
            val waMatch = waRegex.find(lower)
            if (waMatch != null) {
                val target = waMatch.groupValues[1].ifEmpty { waMatch.groupValues[2] }.trim()
                val isCall = lower.contains("call")
                return AppCommand(if (isCall) "WHATSAPP_CALL" else "WHATSAPP_MSG", mapOf("name" to target))
            }

            // 7. General Call
            val callRegex = Regex("(?:(.*?)\\\\s+ko\\\\s+call\\\\s+karo)|(?:^call\\\\s+(.*?)$)", RegexOption.IGNORE_CASE)
            val callMatch = callRegex.find(lower)
            if (callMatch != null) {
                val target = callMatch.groupValues[1].ifEmpty { callMatch.groupValues[2] }.trim()
                if (target.isNotEmpty() && !target.contains("close friend")) {
                    return AppCommand("CALL", mapOf("name" to target))
                }
            }

            // 8. SMS
            val smsRegex = Regex("(?:sms\\\\s+(?:bhejo|karo)\\\\s+(.*?)\\\\s+ko)|(?:(.*?)\\\\s+ko\\\\s+sms\\\\s+bhejo)", RegexOption.IGNORE_CASE)
            val smsMatch = smsRegex.find(lower)
            if (smsMatch != null) {
                val target = smsMatch.groupValues[1].ifEmpty { smsMatch.groupValues[2] }.trim()
                return AppCommand("SMS", mapOf("name" to target))
            }

            // 9. Close App
            val closeRegex = Regex("(?:(.*?)\\\\s+(?:band\\\\s+karo|close))|(?:^close\\\\s+(.*?)$)", RegexOption.IGNORE_CASE)
            val closeMatch = closeRegex.find(lower)
            if (closeMatch != null) {
                val appName = closeMatch.groupValues[1].ifEmpty { closeMatch.groupValues[2] }.trim()
                return AppCommand("CLOSE_APP", mapOf("app_name" to appName))
            }

            // 10. Open App
            val openRegex = Regex("(?:(.*?)\\\\s+(?:kholo|open|chalao))|(?:^open\\\\s+(.*?)$)", RegexOption.IGNORE_CASE)
            val openMatch = openRegex.find(lower)
            if (openMatch != null) {
                val appName = openMatch.groupValues[1].ifEmpty { openMatch.groupValues[2] }.trim()
                return AppCommand("OPEN_APP", mapOf("app_name" to appName))
            }

            return null
        }
    }
}
`,
  },

  // ==========================================
  // APP COMMAND MODEL
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/model/AppCommand.kt',
    name: 'AppCommand.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.model

data class AppCommand(
    val type: String,
    val params: Map<String, String>
)
`,
  },

  // ==========================================
  // MAIN VIEW MODEL (Phone Automation Actions)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/viewmodel/MainViewModel.kt',
    name: 'MainViewModel.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.viewmodel

import android.app.Application
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.provider.ContactsContract
import android.telecom.TelecomManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.myra.assistant.model.AppCommand
import com.myra.assistant.service.AccessibilityHelperService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val _commandResult = MutableLiveData<String?>()
    val commandResult: LiveData<String?> = _commandResult

    private val knownAppPackages = mapOf(
        "youtube" to "com.google.android.youtube",
        "whatsapp" to "com.whatsapp",
        "instagram" to "com.instagram.android",
        "facebook" to "com.facebook.katana",
        "chrome" to "com.android.chrome",
        "gmail" to "com.google.android.gm",
        "maps" to "com.google.android.apps.maps",
        "spotify" to "com.spotify.music",
        "netflix" to "com.netflix.mediaclient",
        "telegram" to "org.telegram.messenger",
        "calculator" to "com.google.android.calculator"
    )

    fun executeCommand(command: AppCommand) {
        viewModelScope.launch(Dispatchers.IO) {
            val app = getApplication<Application>()
            when (command.type) {
                "OPEN_APP" -> {
                    val appName = command.params["app_name"] ?: ""
                    openApp(appName)
                }
                "CLOSE_APP" -> {
                    closeApp()
                }
                "CALL" -> {
                    val name = command.params["name"] ?: ""
                    val number = resolveContactNumber(name)
                    if (number != null) makePhoneCall(number)
                    else _commandResult.postValue("Contact not found for $name")
                }
                "PRIME_CALL" -> {
                    val index = command.params["index"]?.toIntOrNull() ?: 0
                    val number = getPrimeContactNumber(index)
                    if (number != null) makePhoneCall(number)
                    else _commandResult.postValue("Prime contact #$index not configured in Settings")
                }
                "VOLUME_UP" -> {
                    val audioManager = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                    _commandResult.postValue("Volume badha diya hai.")
                }
                "VOLUME_DOWN" -> {
                    val audioManager = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                    _commandResult.postValue("Volume kam kar diya hai.")
                }
                "FLASHLIGHT_ON" -> {
                    setFlashlight(true)
                    _commandResult.postValue("Torch on kar di hai.")
                }
                "FLASHLIGHT_OFF" -> {
                    setFlashlight(false)
                    _commandResult.postValue("Torch band kar di hai.")
                }
            }
        }
    }

    private fun openApp(name: String) {
        val app = getApplication<Application>()
        val pkg = knownAppPackages[name.lowercase()]
        val intent = if (pkg != null) {
            app.packageManager.getLaunchIntentForPackage(pkg)
        } else {
            // Fallback scan installed apps
            app.packageManager.getInstalledApplications(0).firstOrNull {
                it.loadLabel(app.packageManager).toString().contains(name, ignoreCase = true)
            }?.let { app.packageManager.getLaunchIntentForPackage(it.packageName) }
        }

        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            app.startActivity(intent)
            _commandResult.postValue("$name open kar diya!")
        } else {
            _commandResult.postValue("$name app nahi mila.")
        }
    }

    private fun closeApp() {
        if (AccessibilityHelperService.isEnabled(getApplication())) {
            AccessibilityHelperService.instance?.closeCurrentApp()
            _commandResult.postValue("App band kar diya gaya.")
        } else {
            _commandResult.postValue("Accessibility permission off hai. Please Settings se enable karein.")
        }
    }

    private fun makePhoneCall(number: String) {
        val app = getApplication<Application>()
        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            app.startActivity(intent)
            _commandResult.postValue("Call lagayi ja rahi hai: $number")
        } catch (e: Exception) {
            _commandResult.postValue("Call karne mein error aayi.")
        }
    }

    private fun resolveContactNumber(name: String): String? {
        val app = getApplication<Application>()
        val cursor = app.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "\${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
            arrayOf("%$name%"),
            null
        )
        cursor?.use {
            if (it.moveToFirst()) return it.getString(0)
        }
        return null
    }

    private fun getPrimeContactNumber(index: Int): String? {
        val prefs = getApplication<Application>().getSharedPreferences("myra_prefs", Context.MODE_PRIVATE)
        val jsonStr = prefs.getString("prime_contacts_json", null)
        if (jsonStr != null) {
            val arr = JSONArray(jsonStr)
            if (index < arr.length()) {
                return arr.getJSONObject(index).optString("number")
            }
        }
        // Legacy fallback
        return if (index == 0) prefs.getString("prime_number", null) else null
    }

    private fun setFlashlight(enabled: Boolean) {
        val app = getApplication<Application>()
        val cameraManager = app.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = cameraManager.cameraIdList[0]
        cameraManager.setTorchMode(cameraId, enabled)
    }

    fun acceptCall() {
        val app = getApplication<Application>()
        val telecomManager = app.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        try {
            telecomManager.acceptRingingCall()
            _commandResult.postValue("Call accept kar liya gaya hai.")
        } catch (e: Exception) {
            _commandResult.postValue("Call uthane mein error aayi.")
        }
    }

    fun rejectCall() {
        val app = getApplication<Application>()
        val telecomManager = app.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        try {
            telecomManager.endCall()
            _commandResult.postValue("Call reject kar di gayi hai.")
        } catch (e: Exception) {
            _commandResult.postValue("Call reject karne mein error aayi.")
        }
    }
}
`,
  },

  // ==========================================
  // ORB ANIMATION VIEW (7 Canvas Layers)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ui/main/OrbAnimationView.kt',
    name: 'OrbAnimationView.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ui.main

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.cos
import kotlin.math.sin

class OrbAnimationView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    enum class State { IDLE, LISTENING, SPEAKING, THINKING }

    var orbState: State = State.IDLE
        set(value) {
            field = value
            invalidate()
        }

    private var amplitude = 0f
    private var rotationAngle = 0f
    private var waveOffset = 0f
    private var thinkingAngle = 0f
    private var pulseScale = 1.0f

    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val corePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    private val wavePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2.5f
    }
    private val thinkingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 7f
        strokeCap = Paint.Cap.ROUND
        color = Color.parseColor("#40C4FF")
    }
    private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val rotationAnimator = ValueAnimator.ofFloat(0f, 360f).apply {
        duration = 3000L
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener {
            rotationAngle = it.animatedValue as Float
            waveOffset += 0.1f
            thinkingAngle += 3f
            invalidate()
        }
    }

    private val pulseAnimator = ValueAnimator.ofFloat(1.0f, 1.15f, 1.0f).apply {
        duration = 1500L
        repeatCount = ValueAnimator.INFINITE
        addUpdateListener {
            pulseScale = it.animatedValue as Float
            invalidate()
        }
    }

    init {
        rotationAnimator.start()
        pulseAnimator.start()
    }

    fun setAmplitude(rms: Float) {
        this.amplitude = rms
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val baseRadius = width * 0.32f
        val currentRadius = baseRadius * (if (orbState == State.IDLE) pulseScale else (1f + amplitude * 0.35f))

        val (primaryColor, secondaryColor) = when (orbState) {
            State.IDLE -> Pair("#B71C1C", "#880E4F")
            State.LISTENING -> Pair("#FF1744", "#D500F9")
            State.SPEAKING -> Pair("#E040FB", "#FF1744")
            State.THINKING -> Pair("#40C4FF", "#00B0FF")
        }

        // Layer 1: Radial Glow
        glowPaint.shader = RadialGradient(
            cx, cy, currentRadius * 1.6f,
            Color.parseColor(primaryColor), Color.TRANSPARENT, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, currentRadius * 1.6f, glowPaint)

        // Layer 2: Core Orb
        corePaint.shader = RadialGradient(
            cx - currentRadius * 0.3f, cy - currentRadius * 0.3f, currentRadius,
            Color.parseColor(primaryColor), Color.parseColor(secondaryColor), Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, currentRadius, corePaint)

        // Layer 3: 3 Rotating Rings
        ringPaint.color = Color.parseColor(primaryColor)
        ringPaint.pathEffect = DashPathEffect(floatArrayOf(20f, 15f), 0f)
        canvas.save()
        canvas.rotate(rotationAngle, cx, cy)
        canvas.drawCircle(cx, cy, currentRadius * 1.2f, ringPaint)
        canvas.drawCircle(cx, cy, currentRadius * 1.35f, ringPaint)
        canvas.drawCircle(cx, cy, currentRadius * 1.5f, ringPaint)
        canvas.restore()

        // Layer 4: Wave Rings
        if (orbState != State.IDLE) {
            wavePaint.color = Color.parseColor(secondaryColor)
            val path = Path()
            val points = 36
            for (p in 0..points) {
                val angle = (p.toDouble() / points) * Math.PI * 2
                val waveAmp = (amplitude * 20f + 6f) * sin(angle * 6 + waveOffset).toFloat()
                val r = currentRadius * 1.15f + waveAmp
                val x = cx + cos(angle).toFloat() * r
                val y = cy + sin(angle).toFloat() * r
                if (p == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            path.close()
            canvas.drawPath(path, wavePaint)
        }

        // Layer 5: Thinking Arc
        if (orbState == State.THINKING) {
            canvas.save()
            canvas.rotate(thinkingAngle, cx, cy)
            canvas.drawArc(cx - currentRadius * 1.25f, cy - currentRadius * 1.25f,
                cx + currentRadius * 1.25f, cy + currentRadius * 1.25f, 0f, 140f, false, thinkingPaint)
            canvas.restore()
        }

        // Layer 6: Orbiting Particles (12 dots)
        if (orbState == State.LISTENING || orbState == State.SPEAKING) {
            particlePaint.color = Color.parseColor(primaryColor)
            for (i in 0 until 12) {
                val angle = Math.toRadians((rotationAngle + i * 30.0))
                val r = currentRadius * 1.3f + (amplitude * 15f)
                val px = cx + cos(angle).toFloat() * r
                val py = cy + sin(angle).toFloat() * r
                canvas.drawCircle(px, py, 4f, particlePaint)
            }
        }

        // Layer 7: Inner Highlight
        highlightPaint.shader = RadialGradient(
            cx - currentRadius * 0.4f, cy - currentRadius * 0.4f, currentRadius * 0.4f,
            Color.WHITE, Color.TRANSPARENT, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx - currentRadius * 0.4f, cy - currentRadius * 0.4f, currentRadius * 0.4f, highlightPaint)
    }
}
`,
  },

  // ==========================================
  // WAVEFORM VIEW (20 Bars Lerp Animation)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ui/main/WaveformView.kt',
    name: 'WaveformView.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ui.main

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.abs
import kotlin.math.sin

class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val barCount = 20
    private val barHeights = FloatArray(barCount) { 8f }
    private var amplitude = 0f
    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 50L
        repeatCount = ValueAnimator.INFINITE
        addUpdateListener {
            val maxH = height.toFloat()
            for (i in 0 until barCount) {
                val centerFactor = 1.0f - abs(i - barCount / 2f) / (barCount / 2f) * 0.5f
                val jitter = sin(System.currentTimeMillis() * 0.02 + i).toFloat() * 0.3f + 1f
                val target = maxOf(8f, amplitude * maxH * 0.9f * centerFactor * jitter)
                barHeights[i] += (target - barHeights[i]) * 0.3f
            }
            invalidate()
        }
    }

    init {
        animator.start()
    }

    fun setAmplitude(rms: Float) {
        this.amplitude = rms
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val barWidth = (w - (barCount - 1) * 8f) / barCount

        for (i in 0 until barCount) {
            val barH = barHeights[i].coerceIn(8f, h)
            val left = i * (barWidth + 8f)
            val top = (h - barH) / 2f
            val right = left + barWidth
            val bottom = top + barH

            val alpha = (150 + (barH / h * 105)).toInt().coerceIn(150, 255)
            barPaint.color = Color.argb(alpha, 255, 23, 68)

            canvas.drawRoundRect(RectF(left, top, right, bottom), 4f, 4f, barPaint)
        }
    }
}
`,
  },

  // ==========================================
  // MAIN ACTIVITY (Core Orchestrator)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ui/main/MainActivity.kt',
    name: 'MainActivity.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ui.main

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.myra.assistant.R
import com.myra.assistant.ai.AudioEngine
import com.myra.assistant.ai.CommandParser
import com.myra.assistant.ai.GeminiLiveClient
import com.myra.assistant.databinding.ActivityMainBinding
import com.myra.assistant.service.CallMonitorService
import com.myra.assistant.service.MyraOverlayService
import com.myra.assistant.ui.settings.SettingsActivity
import com.myra.assistant.viewmodel.MainViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: MainViewModel by viewModels()

    private var geminiLive: GeminiLiveClient? = null
    private var audioEngine: AudioEngine? = null
    private val handler = Handler(Looper.getMainLooper())

    private val inputBuffer = StringBuilder()
    private val outputBuffer = StringBuilder()

    private var isInCallMode = false
    private var isMuted = false

    private val requiredPermissions = arrayOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.CALL_PHONE,
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.ANSWER_PHONE_CALLS
    )

    private val callEndedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            isInCallMode = false
            audioEngine?.setMuted(false)
            binding.orbView.orbState = OrbAnimationView.State.IDLE
            binding.statusText.text = "Tap karke bolo 💬"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        initViews()
        checkPermissions()
        startSystemServices()
        startStatusUpdates()
        registerReceiver(callEndedReceiver, IntentFilter("com.myra.CALL_ENDED"))

        handler.postDelayed({ initGeminiLive() }, 300)
        handleIncomingCallIntent(intent)
    }

    private fun initViews() {
        binding.settingsBtn.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        binding.micButton.setOnClickListener {
            toggleMute()
        }

        binding.micButton.setOnLongClickListener {
            audioEngine?.interruptPlayback()
            geminiLive?.interrupt()
            Toast.makeText(this, "MYRA Interrupted", Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun checkPermissions() {
        val missing = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 101)
        }
    }

    private fun startSystemServices() {
        startService(Intent(this, CallMonitorService::class.java))
        startService(Intent(this, MyraOverlayService::class.java))
    }

    private fun initGeminiLive() {
        geminiLive = GeminiLiveClient(this)
        audioEngine = AudioEngine(this)

        audioEngine?.onAudioChunkCaptured = { pcm ->
            if (!isInCallMode) geminiLive?.sendAudioChunk(pcm)
        }

        audioEngine?.onAmplitudeChanged = { rms ->
            binding.orbView.setAmplitude(rms)
            binding.waveformView.setAmplitude(rms)
        }

        audioEngine?.onSpeakingStarted = {
            binding.orbView.orbState = OrbAnimationView.State.SPEAKING
            binding.statusText.text = "Bol rahi hoon..."
            setRedOverlayAlpha(0.08f)
        }

        audioEngine?.onSpeakingStopped = {
            binding.orbView.orbState = OrbAnimationView.State.LISTENING
            binding.statusText.text = "Sun rahi hoon..."
            setRedOverlayAlpha(0f)
        }

        geminiLive?.onConnected = {
            binding.statusText.text = "MYRA Online"
            audioEngine?.startRecording()
            audioEngine?.startPlayback()
            handler.postDelayed({ sendGreeting() }, 600)
        }

        geminiLive?.onAudioReceived = { pcm24k ->
            audioEngine?.queueAudio(pcm24k)
        }

        geminiLive?.onInputTranscript = { text ->
            inputBuffer.append(text)
        }

        geminiLive?.onOutputTranscript = { text ->
            outputBuffer.append(text)
        }

        geminiLive?.onTurnComplete = {
            val userText = inputBuffer.toString().trim()
            val myraText = outputBuffer.toString().trim()
            inputBuffer.clear()
            outputBuffer.clear()

            if (userText.isNotEmpty()) {
                val command = CommandParser.parse(userText)
                if (command != null) {
                    viewModel.executeCommand(command)
                }
            }
        }

        geminiLive?.connect()
    }

    private fun sendGreeting() {
        val prefs = getSharedPreferences("myra_prefs", MODE_PRIVATE)
        val name = prefs.getString("user_name", "Sonu")
        val personality = prefs.getString("personality_mode", "gf")

        val greeting = when (personality) {
            "gf" -> "Hey $name! Main aa gayi hoon. Kya help chahiye tumhe? ❤️"
            "professional" -> "Good day $name. MYRA is online and ready to assist you."
            else -> "Hello $name! Main MYRA hoon. Kaise help karun aapki?"
        }
        geminiLive?.sendText(greeting)
    }

    private fun toggleMute() {
        isMuted = !isMuted
        audioEngine?.setMuted(isMuted)
        binding.micButton.setImageResource(if (isMuted) R.drawable.ic_mic_off else R.drawable.ic_mic_on)
        binding.statusText.text = if (isMuted) "Mic Muted" else "Sun rahi hoon..."
    }

    private fun setRedOverlayAlpha(alpha: Float) {
        binding.redOverlay.animate().alpha(alpha).setDuration(300).start()
    }

    private fun handleIncomingCallIntent(intent: Intent?) {
        if (intent?.getBooleanExtra("INCOMING_CALL", false) == true) {
            val callerName = intent.getStringExtra("CALLER_NAME") ?: "Someone"
            announceCall(callerName)
        }
    }

    private fun announceCall(callerName: String) {
        isInCallMode = true
        geminiLive?.sendText("Sir, $callerName ka call aa raha hai. Uthau ya reject karu?")
    }

    private fun startStatusUpdates() {
        handler.post(object : Runnable {
            override fun run() {
                val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
                binding.timeText.text = time

                val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
                val bat = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                binding.batteryText.text = "\${bat}%"

                handler.postDelayed(this, 30000)
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(callEndedReceiver)
        geminiLive?.disconnect()
        audioEngine?.release()
    }
}
`,
  },

  // ==========================================
  // ACCESSIBILITY SERVICE
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/service/AccessibilityHelperService.kt',
    name: 'AccessibilityHelperService.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.service

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AccessibilityHelperService : AccessibilityService() {

    companion object {
        var instance: AccessibilityHelperService? = null
            private set

        fun isEnabled(context: Context): Boolean {
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            return enabledServices.contains(context.packageName)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    fun closeCurrentApp() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    fun goBack() {
        performGlobalAction(GLOBAL_ACTION_BACK)
    }

    fun clickOnText(text: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val nodes = rootNode.findAccessibilityNodeInfosByText(text)
        for (node in nodes) {
            if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true
            }
            node.parent?.let { parent ->
                if (parent.isClickable && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    return true
                }
            }
        }
        return false
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
`,
  },

  // ==========================================
  // CALL MONITOR SERVICE (PhoneStateListener)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/service/CallMonitorService.kt',
    name: 'CallMonitorService.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.net.Uri
import android.os.IBinder
import android.provider.ContactsContract
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import com.myra.assistant.R
import com.myra.assistant.ui.main.MainActivity

class CallMonitorService : Service() {

    private lateinit var telephonyManager: TelephonyManager

    private val phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            when (state) {
                TelephonyManager.CALL_STATE_RINGING -> {
                    val name = resolveCallerName(phoneNumber) ?: "Unknown"
                    val intent = Intent(this@CallMonitorService, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        putExtra("INCOMING_CALL", true)
                        putExtra("CALLER_NAME", name)
                    }
                    startActivity(intent)
                }
                TelephonyManager.CALL_STATE_IDLE -> {
                    sendBroadcast(Intent("com.myra.CALL_ENDED"))
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        telephonyManager = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
        telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
        startForeground(1001, createNotification())
    }

    private fun resolveCallerName(number: String?): String? {
        if (number.isNullOrEmpty()) return null
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
        val cursor = contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
        cursor?.use {
            if (it.moveToFirst()) return it.getString(0)
        }
        return number
    }

    private fun createNotification(): Notification {
        val channelId = "myra_call_monitor"
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(channelId, "MYRA Call Monitor", NotificationManager.IMPORTANCE_LOW)
        manager.createNotificationChannel(channel)

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("MYRA Call Assistant Active")
            .setSmallIcon(R.drawable.ic_myra_notif)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
`,
  },

  // ==========================================
  // OVERLAY SERVICE (Floating Orb)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/service/MyraOverlayService.kt',
    name: 'MyraOverlayService.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.myra.assistant.R
import com.myra.assistant.ui.main.MainActivity

class MyraOverlayService : Service() {

    companion object {
        var isRunning = false
        const val CHANNEL_ID = "myra_overlay_channel"
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        startForeground(2001, NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MYRA Floating Assistant Active")
            .setSmallIcon(R.drawable.ic_myra_notif)
            .build()
        )
        initOverlayView()
    }

    private fun initOverlayView() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_orb, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 300
        }

        overlayView?.findViewById<View>(R.id.overlayCloseBtn)?.setOnClickListener {
            stopSelf()
        }

        overlayView?.findViewById<View>(R.id.overlayOrbContainer)?.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }

        // Draggable touch listener
        overlayView?.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX + (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager?.updateViewLayout(overlayView, params)
                        return true
                    }
                }
                return false
            }
        })

        windowManager?.addView(overlayView, params)
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(CHANNEL_ID, "MYRA Overlay", NotificationManager.IMPORTANCE_LOW)
        manager.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        overlayView?.let { windowManager?.removeView(it) }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
`,
  },

  // ==========================================
  // POWER BUTTON RECEIVER (Double Press Trigger)
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/service/PowerButtonReceiver.kt',
    name: 'PowerButtonReceiver.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PowerButtonReceiver : BroadcastReceiver() {

    companion object {
        private var lastPressTime = 0L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_SCREEN_OFF || action == Intent.ACTION_SCREEN_ON) {
            val now = System.currentTimeMillis()
            if (now - lastPressTime < 600) {
                // Double press detected within 600ms -> start overlay
                val serviceIntent = Intent(context, MyraOverlayService::class.java)
                context.startForegroundService(serviceIntent)
            }
            lastPressTime = now
        }
    }
}
`,
  },

  // ==========================================
  // SETTINGS ACTIVITY
  // ==========================================
  {
    path: 'app/src/main/java/com/myra/assistant/ui/settings/SettingsActivity.kt',
    name: 'SettingsActivity.kt',
    category: 'kotlin',
    language: 'kotlin',
    content: `package com.myra.assistant.ui.settings

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.myra.assistant.databinding.ActivitySettingsBinding
import com.myra.assistant.service.AccessibilityHelperService

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    private val models = arrayOf(
        "models/gemini-2.5-flash-native-audio-preview-12-2025",
        "models/gemini-2.0-flash-live-001",
        "models/gemini-2.5-flash-preview-native-audio-dialog"
    )

    private val voices = arrayOf("Aoede", "Charon", "Kore", "Fenrir", "Puck", "Leda", "Orus", "Zephyr")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        loadPreferences()
        setupSpinners()
        setupAccessibilityCheck()

        binding.saveButton.setOnClickListener {
            savePreferences()
            Toast.makeText(this, "Restart app to apply changes", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun setupSpinners() {
        binding.modelSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, models)
        binding.voiceSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, voices)
    }

    private fun loadPreferences() {
        val prefs = getSharedPreferences("myra_prefs", Context.MODE_PRIVATE)
        binding.apiKeyInput.setText(prefs.getString("api_key", ""))
        binding.nameInput.setText(prefs.getString("user_name", "Sonu"))
    }

    private fun savePreferences() {
        val prefs = getSharedPreferences("myra_prefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("api_key", binding.apiKeyInput.text.toString().trim())
            putString("user_name", binding.nameInput.text.toString().trim())
            putString("gemini_model", binding.modelSpinner.selectedItem.toString())
            putString("gemini_voice", binding.voiceSpinner.selectedItem.toString())
            apply()
        }
    }

    private fun setupAccessibilityCheck() {
        val enabled = AccessibilityHelperService.isEnabled(this)
        binding.accessibilityStatus.text = if (enabled) "Accessibility: ACTIVE ✅" else "Accessibility: INACTIVE ❌"
        binding.accessibilityStatus.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
    }
}
`,
  },

  // ==========================================
  // ANDROID MANIFEST
  // ==========================================
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'config',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions for Audio & Networking -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Permissions for Phone & Contacts -->
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />

    <!-- Services & System Automation -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FLASHLIGHT" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Myra"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".ui.main.MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".ui.settings.SettingsActivity"
            android:exported="false"
            android:screenOrientation="portrait" />

        <service
            android:name=".service.MyraOverlayService"
            android:foregroundServiceType="microphone" />

        <service
            android:name=".service.CallMonitorService"
            android:foregroundServiceType="phoneCall" />

        <service
            android:name=".service.AccessibilityHelperService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <receiver
            android:name=".service.PowerButtonReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.SCREEN_OFF" />
                <action android:name="android.intent.action.SCREEN_ON" />
            </intent-filter>
        </receiver>

        <receiver
            android:name=".service.BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
`,
  },

  // ==========================================
  // APP BUILD.GRADLE
  // ==========================================
  {
    path: 'app/build.gradle',
    name: 'app/build.gradle',
    category: 'gradle',
    language: 'groovy',
    content: `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'kotlin-kapt'
}

android {
    namespace 'com.myra.assistant'
    compileSdk 34

    defaultConfig {
        applicationId "com.myra.assistant"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.debug
        }
        debug {
            applicationIdSuffix ".debug"
            debuggable true
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    buildFeatures {
        viewBinding true
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.cardview:cardview:1.0.0'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'androidx.activity:activity-ktx:1.9.0'
    implementation 'androidx.fragment:fragment-ktx:1.7.1'
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.security:security-crypto:1.1.0-alpha06'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'org.json:json:20231013'
    implementation 'com.google.ai.client.generativeai:generativeai:0.9.0'
}
`,
  },

  // ==========================================
  // LAYOUT ACTIVITY MAIN
  // ==========================================
  {
    path: 'app/src/main/res/layout/activity_main.xml',
    name: 'activity_main.xml',
    category: 'layout',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/bg_gradient_mesh">

    <!-- Red Overlay Active Effect -->
    <View
        android:id="@+id/redOverlay"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="#FF1744"
        android:alpha="0" />

    <!-- Main Content Container -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical">

        <!-- Top Bar -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:paddingTop="40dp"
            android:paddingHorizontal="20dp"
            android:gravity="center_vertical"
            android:orientation="horizontal">

            <TextView
                android:id="@+id/batteryText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="98%"
                android:textColor="#FF1744"
                android:fontFamily="monospace"
                android:textSize="12sp" />

            <View
                android:layout_width="0dp"
                android:layout_height="1dp"
                android:layout_weight="1" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:gravity="center"
                android:orientation="vertical">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="MYRA"
                    android:textColor="#FF1744"
                    android:textStyle="bold"
                    android:textSize="18sp"
                    android:letterSpacing="0.2" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="AI COMPANION"
                    android:textColor="#888888"
                    android:fontFamily="monospace"
                    android:textSize="9sp" />
            </LinearLayout>

            <View
                android:layout_width="0dp"
                android:layout_height="1dp"
                android:layout_weight="1" />

            <TextView
                android:id="@+id/timeText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="14:02"
                android:textColor="#FF1744"
                android:fontFamily="monospace"
                android:textSize="12sp"
                android:layout_marginEnd="12dp" />

            <ImageButton
                android:id="@+id/settingsBtn"
                android:layout_width="32dp"
                android:layout_height="32dp"
                android:background="?selectableItemBackgroundBorderless"
                android:src="@drawable/ic_settings" />
        </LinearLayout>

        <!-- Center Orb & Visualizers -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:gravity="center"
            android:orientation="vertical">

            <com.myra.assistant.ui.main.OrbAnimationView
                android:id="@+id/orbView"
                android:layout_width="260dp"
                android:layout_height="260dp" />

            <com.myra.assistant.ui.main.WaveformView
                android:id="@+id/waveformView"
                android:layout_width="200dp"
                android:layout_height="40dp"
                android:layout_marginTop="16dp" />

            <TextView
                android:id="@+id/statusText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Tap karke bolo 💬"
                android:textColor="#888888"
                android:textSize="13sp"
                android:layout_marginTop="12dp" />
        </LinearLayout>

        <!-- Bottom Controls & Chat -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:paddingBottom="28dp"
            android:gravity="center_horizontal"
            android:orientation="vertical">

            <ImageButton
                android:id="@+id/micButton"
                android:layout_width="72dp"
                android:layout_height="72dp"
                android:background="@drawable/bg_mic_button"
                android:src="@drawable/ic_mic_off" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Long press to stop"
                android:textColor="#555555"
                android:textSize="11sp"
                android:layout_marginTop="8dp" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
`,
  },

  // ==========================================
  // COLORS.XML & THEMES.XML
  // ==========================================
  {
    path: 'app/src/main/res/values/colors.xml',
    name: 'colors.xml',
    category: 'config',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="bg_dark">#050505</color>
    <color name="primary_red">#FF1744</color>
    <color name="secondary_purple">#D500F9</color>
    <color name="card_bg">#111111</color>
    <color name="prime_card">#1A0000</color>
    <color name="text_primary">#EEEEEE</color>
    <color name="text_hint">#555555</color>
    <color name="success_green">#00E676</color>
</resources>
`,
  },
  {
    path: 'app/src/main/res/values/themes.xml',
    name: 'themes.xml',
    category: 'config',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.Myra" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:statusBarColor">#00000000</item>
        <item name="android:navigationBarColor">#050505</item>
        <item name="android:windowBackground">@color/bg_dark</item>
        <item name="colorPrimary">@color/primary_red</item>
        <item name="colorSecondary">@color/secondary_purple</item>
    </style>
</resources>
`,
  },
];
