import { AppCommand } from '../types/assistant';

export class CommandParser {
  /**
   * Parses natural language voice text (Hinglish or English) into an AppCommand.
   * Returns null if no phone action is recognized (letting conversational AI answer).
   */
  static parse(text: string): AppCommand | null {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Prime contact calls / messages
    if (
      lower.includes('close friend ko call') ||
      lower.includes('call my close friend') ||
      lower.includes('mere close friend ko call')
    ) {
      return {
        type: 'PRIME_CALL',
        params: { index: '0', contactType: 'close_friend' },
        rawQuery: raw,
        description: 'Calling Prime Contact (Close Friend)',
      };
    }

    if (
      lower.includes('meri jaan ko message') ||
      lower.includes('meri jaan ko msg') ||
      lower.includes('message my love') ||
      lower.includes('msg my love')
    ) {
      return {
        type: 'PRIME_MSG',
        params: { index: '0', contactType: 'love' },
        rawQuery: raw,
        description: 'Sending message to Prime Contact',
      };
    }

    if (lower.includes('second contact') && lower.includes('call')) {
      return {
        type: 'PRIME_CALL',
        params: { index: '1', contactType: 'second_contact' },
        rawQuery: raw,
        description: 'Calling second Prime Contact',
      };
    }

    // 2. Flashlight / Torch
    if (
      lower.includes('torch on') ||
      lower.includes('flashlight on') ||
      lower.includes('torch chalao') ||
      lower.includes('torch jalao') ||
      lower.includes('flashlight chalu')
    ) {
      return {
        type: 'FLASHLIGHT_ON',
        params: {},
        rawQuery: raw,
        description: 'Flashlight turned ON',
      };
    }

    if (
      lower.includes('torch off') ||
      lower.includes('flashlight off') ||
      lower.includes('torch band') ||
      lower.includes('flashlight band')
    ) {
      return {
        type: 'FLASHLIGHT_OFF',
        params: {},
        rawQuery: raw,
        description: 'Flashlight turned OFF',
      };
    }

    // 3. Volume Up / Down
    if (
      lower.includes('volume up') ||
      lower.includes('volume badhao') ||
      lower.includes('awaz badhao') ||
      lower.includes('increase volume')
    ) {
      return {
        type: 'VOLUME_UP',
        params: { step: '10' },
        rawQuery: raw,
        description: 'Media volume increased',
      };
    }

    if (
      lower.includes('volume down') ||
      lower.includes('volume kam karo') ||
      lower.includes('volume ghatao') ||
      lower.includes('awaz kam') ||
      lower.includes('decrease volume')
    ) {
      return {
        type: 'VOLUME_DOWN',
        params: { step: '10' },
        rawQuery: raw,
        description: 'Media volume decreased',
      };
    }

    // 4. Wi-Fi
    if (lower.includes('wifi on') || lower.includes('wi-fi on') || lower.includes('wifi chalu')) {
      return {
        type: 'WIFI_ON',
        params: {},
        rawQuery: raw,
        description: 'Wi-Fi activated',
      };
    }

    if (lower.includes('wifi off') || lower.includes('wi-fi off') || lower.includes('wifi band')) {
      return {
        type: 'WIFI_OFF',
        params: {},
        rawQuery: raw,
        description: 'Wi-Fi deactivated',
      };
    }

    // 5. Bluetooth
    if (lower.includes('bluetooth on') || lower.includes('bt on') || lower.includes('bluetooth chalu')) {
      return {
        type: 'BLUETOOTH_ON',
        params: {},
        rawQuery: raw,
        description: 'Bluetooth enabled',
      };
    }

    if (lower.includes('bluetooth off') || lower.includes('bt off') || lower.includes('bluetooth band')) {
      return {
        type: 'BLUETOOTH_OFF',
        params: {},
        rawQuery: raw,
        description: 'Bluetooth disabled',
      };
    }

    // 6. WhatsApp Msg or Call
    const waMatch = lower.match(/whatsapp\s+(karo|bhejo|message|call)\s+(.*?)(ko)?$/i) ||
                    lower.match(/(.*?)\s+ko\s+whatsapp\s+(karo|karna|message)/i);
    if (waMatch) {
      const target = (waMatch[2] || waMatch[1] || '').trim();
      const isCall = lower.includes('call');
      return {
        type: isCall ? 'WHATSAPP_CALL' : 'WHATSAPP_MSG',
        params: { name: target || 'Friend' },
        rawQuery: raw,
        description: isCall ? `Initiating WhatsApp call to ${target || 'contact'}` : `Opening WhatsApp chat with ${target || 'contact'}`,
      };
    }

    // 7. General Call
    // "[name] ko call karo" or "call [name]"
    const callMatch1 = lower.match(/(.*?)\s+ko\s+call\s+(karo|lagao|milao)/i);
    const callMatch2 = lower.match(/^call\s+(.*?)$/i);
    if (callMatch1 && callMatch1[1]) {
      const name = callMatch1[1].trim();
      return {
        type: 'CALL',
        params: { name },
        rawQuery: raw,
        description: `Calling ${name}...`,
      };
    }
    if (callMatch2 && callMatch2[1] && !callMatch2[1].includes('close friend')) {
      const name = callMatch2[1].trim();
      return {
        type: 'CALL',
        params: { name },
        rawQuery: raw,
        description: `Calling ${name}...`,
      };
    }

    // 8. SMS
    const smsMatch = lower.match(/sms\s+(bhejo|karo)\s+(.*?)\s+ko/i) ||
                     lower.match(/(.*?)\s+ko\s+sms\s+(bhejo|karo)/i);
    if (smsMatch) {
      const name = (smsMatch[2] || smsMatch[1] || '').trim();
      return {
        type: 'SMS',
        params: { name, message: '' },
        rawQuery: raw,
        description: `Composing SMS to ${name}`,
      };
    }

    // 9. Close App
    const closeMatch = lower.match(/(.*?)\s+(band\s+karo|hatao|close)/i) ||
                       lower.match(/^close\s+(.*?)$/i);
    if (closeMatch && closeMatch[1]) {
      const appName = closeMatch[1].trim();
      if (['whatsapp', 'youtube', 'instagram', 'chrome', 'camera', 'spotify'].some(a => appName.includes(a))) {
        return {
          type: 'CLOSE_APP',
          params: { app_name: appName },
          rawQuery: raw,
          description: `Closing ${appName} via Accessibility Service`,
        };
      }
    }

    // 10. Open App
    // "youtube kholo", "open youtube", "kholo instagram"
    const openMatch1 = lower.match(/(.*?)\s+(kholo|chalao|open)/i);
    const openMatch2 = lower.match(/^(open|launch)\s+(.*?)$/i);
    const candidateApp = openMatch2 ? openMatch2[2] : (openMatch1 ? openMatch1[1] : null);

    if (candidateApp) {
      const appClean = candidateApp.trim().replace(/kripya|please|jaldi/g, '').trim();
      const knownApps = [
        'youtube', 'whatsapp', 'instagram', 'facebook', 'chrome',
        'gmail', 'maps', 'spotify', 'netflix', 'twitter', 'x',
        'telegram', 'snapchat', 'settings', 'calculator', 'calendar',
        'clock', 'phone', 'contacts', 'play store', 'amazon', 'flipkart',
        'paytm', 'phonepe', 'gpay', 'zoom', 'camera', 'gallery'
      ];

      for (const ka of knownApps) {
        if (appClean.includes(ka) || ka.includes(appClean)) {
          return {
            type: 'OPEN_APP',
            params: { app_name: ka },
            rawQuery: raw,
            description: `Launching ${ka.toUpperCase()}`,
          };
        }
      }
    }

    return null;
  }
}
