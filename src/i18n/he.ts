// All user-facing text. The app is Hebrew-only and runs in forced RTL (see MainApplication.kt).

/** Wraps LTR content (IPs, URLs, counters) in a bidi isolate so it isn't reordered inside RTL text. */
export const ltr = (text: string | number) => `⁦${text}⁩`;

export const timeStamp = () => new Date().toLocaleTimeString('he-IL', { hour12: false });

export const he = {
  common: {
    verified: 'אומתה',
    notVerified: 'לא אומתה',
  },

  wizard: {
    title: 'הגדרה',
    close: 'סגירה',
    steps: ['חיבור', 'מדפסות', 'אימות'],
    back: 'חזרה',
    next: 'הבא',
    saveAndContinue: 'שמירה והמשך',
    finish: 'סיום',

    connectIntro: 'חברו את המכשיר לשרת ההדפסה. את מפתח הסוכן אפשר למצוא בלוח הניהול של השרת.',
    tenant: 'שם העסק',
    serverUrl: 'כתובת המערכת',
    agentKey: 'מפתח זיהוי',
    testConnection: 'ההתחבר',
    connected: 'מחובר — השרת אישר את מפתח הזיהוי.',

    printersIntro: 'חיפוש מדפסות רשת ב-Wi-Fi הזה (פורט 9100). תנו לכל מדפסת שם שתזהו.',
    scan: 'סריקת הרשת',
    scanAgain: 'סריקה חוזרת',
    scanning: (progress: string) => `סורק ${ltr(progress)}`,
    noPrintersYet: 'עדיין אין מדפסות.',
    found: (n: number) => (n === 1 ? 'נמצאה מדפסת אחת.' : `נמצאו ${n} מדפסות.`),
    noneFound: 'לא נמצאו מדפסות. ודאו שהטלפון מחובר לאותה רשת Wi-Fi כמו המדפסות.',

    verifyIntro: 'הגדירו כתובת IP קבועה לכל מדפסת בנתב, ואז בדקו שהיא עונה בכתובת הזו.',
    ipAddress: 'כתובת IP',
    verify: 'אימות',
    noAnswer: (name: string, address: string) => `${name} לא ענתה בכתובת ${ltr(address)}.`,
  },

  dashboard: {
    title: 'סוכן הדפסה',
    settings: 'הגדרות',
    stopped: 'כבוי',
    running: 'פועל',
    connecting: 'מתחבר…',
    serverConnected: 'מחובר לשרת',
    serverNotConnected: 'לא מחובר לשרת',
    liveOn: 'עדכונים חיים פעילים',
    liveOff: 'עדכונים חיים כבויים',
    printed: 'הודפסו',
    failed: 'נכשלו',
    start: 'הפעלת הסוכן',
    stop: 'עצירת הסוכן',
    printers: 'מדפסות',
    noPrinters: 'לא הוגדרו מדפסות.',
    activity: 'פעילות',
    noActivity: 'אין פעילות עדיין.',
  },

  errors: {
    cannotConnect: 'לא ניתן להתחבר לשרת. בדקו את הכתובת ואת החיבור לרשת.',
    badKey: 'מפתח הסוכן שגוי או שבוטל.',
    server: (status: number, detail?: string) =>
      `השרת החזיר שגיאה (${ltr(status)})${detail ? `: ${detail}` : ''}`,
    noWifi: 'הטלפון לא מחובר ל-Wi-Fi.',
    printerTimeout: (address: string) => `המדפסת ${ltr(address)} לא הגיבה בזמן.`,
    noLocalPrinter: (name: string) => `אין מדפסת מקומית שמשויכת ל-'${name}'`,
  },

  log: {
    agentStarted: 'הסוכן הופעל',
    agentStopped: 'הסוכן נעצר',
    agentCrashed: (e: unknown) => `הסוכן קרס: ${e}`,
    pollFailed: (reason: string) => `בדיקת התור נכשלה: ${reason}`,
    alreadyClaimed: (id: number) => `עבודה ${ltr(`#${id}`)} כבר נלקחה על ידי סוכן אחר`,
    claimFailed: (id: number, reason: string) => `לקיחת עבודה ${ltr(`#${id}`)} נכשלה: ${reason}`,
    printed: (id: number, printer: string, ip: string, ms: number) =>
      `עבודה ${ltr(`#${id}`)} הודפסה ב-${printer} (${ltr(ip)}) תוך ${ltr(`${ms}ms`)}`,
    jobFailed: (id: number, reason: string) => `עבודה ${ltr(`#${id}`)} נכשלה: ${reason}`,
    reportFailed: (id: number, reason: string) => `לא ניתן לדווח על כישלון עבודה ${ltr(`#${id}`)}: ${reason}`,
    liveConnected: 'עדכונים חיים מחוברים',
    liveDown: (status: number | undefined, retryMs: number) =>
      `עדכונים חיים נותקו${status ? ` (קוד ${ltr(status)})` : ''}. ניסיון חוזר בעוד ${Math.round(retryMs / 1000)} שניות`,
  },

  defaultPrinterName: (lastOctet: string) => `מדפסת-${lastOctet}`,
};
