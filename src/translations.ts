export interface AppTranslations {
  title: string;
  headerTitle: string;
  cameraOption: string;
  sessionSettings: string;
  askMetaAI: string;
  profileLocked: string;
  unlockProfile: string;
  unlockDesc: string;
  joinNowBtn: string;
  businessInfo: string;
  businessName: string;
  category: string;
  categoryValue: string;
  activeTunnelId: string;
  connectionGatewayStatus: string;
  verifiedAcc: string;
  securePanel: string;
  lockedStatus: string;
  verificationFormDesc: string;
  phoneLabel: string;
  phoneInfo: string;
  generatingCodeText: string;
  unlockSubmitBtn: string;
  liveCodeTitle: string;
  lockedCodeTitle: string;
  clickToCopy: string;
  codePendingTitle: string;
  codePendingDesc: string;
  resendPushBtn: string;
  resendPushDesc: string;
  handshakingWaiting: string;
  linkingRulesTitle: string;
  rule1: string;
  rule2: string;
  rule3: string;
  rule4: string;
  backBtn: string;
  connectedSuccessTitle: string;
  connectedSuccessDesc: string;
  verifiedPhone: string;
  logoutBtn: string;
  sessionMembership: string;
  sessionsHeader: string;
  updatingSess: string;
  defaultSess: string;
  deleteSess: string;
  createNewSess: string;
  createNewSessDesc: string;
  sessNamePlaceholder: string;
  sessCreateBtn: string;
  howItWorksTitle: string;
  howItWorksDesc: string;
}

export const translations: Record<'bn' | 'en', AppTranslations> = {
  bn: {
    title: "Nusrat Jahan's Profile",
    headerTitle: "Nusrat Jahan",
    cameraOption: "ক্যামেরা অপশন",
    sessionSettings: "সেশন সেটিংস",
    askMetaAI: "Meta AI অথবা সার্চ করুন...",
    profileLocked: "নুসরাত জাহান এর প্রোফাইল লক করা আছে",
    unlockProfile: "প্রাইভেট প্রোফাইল আনলক করুন",
    unlockDesc: "নুসরাত জাহান এর চ্যাট ইনবক্স, ব্যক্তিগত ছবি এবং ডিরেক্ট নম্বরে সরাসরি এক্সক্লুসিভ অ্যাক্সেস পেতে সংযোগ করুন।",
    joinNowBtn: "সংযুক্ত হন (Join Now)",
    businessInfo: "বিজনেস ইনফরমেশন",
    businessName: "ব্যবসার নাম",
    category: "ক্যাটাগরি",
    categoryValue: "ব্যক্তিগত প্রোফাইল ও নিরাপদ গেটওয়ে",
    activeTunnelId: "সচল টানেল আইডি",
    connectionGatewayStatus: "সংযোগ গেটওয়ে স্ট্যাটাস",
    verifiedAcc: "নিরাপদ অ্যাকাউন্ট ভেরিফাইড",
    securePanel: "নিরাপদ সংযোগ প্যানেল",
    lockedStatus: "লকড",
    verificationFormDesc: "নুসরাত জাহান-এর প্রাইভেট অ্যাকাউন্টে সুরক্ষিত সংযোগ স্থাপন করতে আপনার মোবাইলের সঠিক হোয়াটসঅ্যাপ নম্বরটি দিন। কোনো পাসওয়ার্ড ছাড়াই নিরাপদ লিঙ্কিং কোড তৈরি হবে।",
    phoneLabel: "হোয়াটসঅ্যাপ ফোন নম্বর (কান্ট্রি কোড সহ)",
    phoneInfo: "বিশ্বের সকল দেশের নাম্বার এখানে ইনপুট দিতে পারবেন। সঠিক কান্ট্রি কোড সহ নম্বর লিখুন (আমেরিকা: 1, সৌদি আরব: 966, বাংলাদেশ: 880 ইত্যাদি)।",
    generatingCodeText: "নুসরাত জাহানকে রিকুয়েষ্ট পাঠানো হচ্ছে...",
    unlockSubmitBtn: "আনলক নাম্বারের জন্য আবেদন করুন",
    liveCodeTitle: "সুরক্ষিত গেটওয়ে কোড (লাইভ)",
    lockedCodeTitle: "সুরক্ষিত গেটওয়ে কোড (লকড)",
    clickToCopy: "ক্লিক করে কোডটি কপি করুন",
    codePendingTitle: "ভেরিফিকেশন কোড পেন্ডিং!",
    codePendingDesc: "ডিভাইসটি নুসরাত জাহানের সাথে লিঙ্ক করার প্রসেসটি সচল আছে। কয়েক সেকেন্ড অপেক্ষা করুন, এডমিন অনুমোদন দেওয়া মাত্র কোডটি এখানে স্বয়ংক্রিয়ভাবে লাইভ হবে।",
    resendPushBtn: "পুশ নোটিফিকেশন পুনরায় পাঠান 🔄",
    resendPushDesc: "মোবাইলে \"Enter code to link device\" নোটিফিকেশন পুনরায় পাঠাতে ক্লিক করুন।",
    handshakingWaiting: "সার্ভার হ্যান্ডশেক ও কোড তৈরির অপেক্ষা...",
    linkingRulesTitle: "লিঙ্ক করার ৪টি সহজ নিয়ম:",
    rule1: "আপনার ফোনের WhatsApp অ্যাপের থ্রি-ডট বা মেইন সেটিংস-এ যান।",
    rule2: "Link Devices বোতামে ট্যাপ করে Link a Device সিলেক্ট করুন।",
    rule3: "নিচের দিকে থাকা Link with phone number instead অপশনটিতে ট্যাপ করুন।",
    rule4: "উপরে জেনারেট হওয়া ৮ ডিজিটের কোডটি সঠিক ক্রমে টাইপ করুন। সংযোগটি সাথে সাথে তৈরি হয়ে যাবে।",
    backBtn: "পেছনে ফিরুন (নম্বর পরিবর্তন করুন)",
    connectedSuccessTitle: "আপনার ডিভাইসটি সফলভাবে লিঙ্ক হয়েছে!",
    connectedSuccessDesc: "Nusrat Jahan-এর প্রাইভেট সিঙ্ক সেশনে আপনি সম্পূর্ণ লাইভ অ্যাক্সেস লাভ করেছেন।",
    verifiedPhone: "ভেরিফাইড ফোন নম্বর",
    logoutBtn: "সংযোগ বিচ্ছিন্ন করুন এবং গেটওয়ে ডিলিট করুন",
    sessionMembership: "সেশন ও কানেকশন মেম্বারশীপ",
    sessionsHeader: "সেশন সমূহ",
    updatingSess: "আপডেটিং",
    defaultSess: "ডিফল্ট",
    deleteSess: "সেশন ডিলিট করুন",
    createNewSess: "নতুন সেশন তৈরি করুন",
    createNewSessDesc: "আলাদা হোয়াটসঅ্যাপ অ্যাকাউন্টের জন্য কাস্টম সেশন আইডি দিয়ে নতুন টানেল উইন্ডো ক্রিয়েট করুন।",
    sessNamePlaceholder: "যেমন: my_business",
    sessCreateBtn: "তৈরি",
    howItWorksTitle: "কীভাবে কাজ করে?",
    howItWorksDesc: "Baileys লাইব্রেরিটি হোয়াটসঅ্যাপের অফিসিয়াল ওয়েব ক্লায়েন্ট উইন্ডোর মতো রিকোয়েস্ট তৈরি করে। জেনারেট হওয়া কোডটি মোবাইলে দিলে ডিভাইসটি সফলভাবে লিঙ্ক হয়ে যাবে।"
  },
  en: {
    title: "Nusrat Jahan's Profile",
    headerTitle: "Nusrat Jahan",
    cameraOption: "Camera Option",
    sessionSettings: "Session Settings",
    askMetaAI: "Ask Meta AI or Search...",
    profileLocked: "Nusrat Jahan's Profile is Locked",
    unlockProfile: "Unlock Private Profile",
    unlockDesc: "Unlock direct and exclusive access to Nusrat Jahan's chat inbox, private photos, and phone numbers.",
    joinNowBtn: "Join now",
    businessInfo: "Business Information",
    businessName: "Business Name",
    category: "Category",
    categoryValue: "Personal Profile & Secure Gateways",
    activeTunnelId: "Active Tunnel ID",
    connectionGatewayStatus: "Connection Gateway Status",
    verifiedAcc: "Secure Verified Account",
    securePanel: "Secure Connection Panel",
    lockedStatus: "Locked",
    verificationFormDesc: "Provide your WhatsApp number to establish a secure connection with Nusrat Jahan's private profile. No password needed.",
    phoneLabel: "WhatsApp Phone Number (with Country Code)",
    phoneInfo: "You can enter phone numbers from any country around the world. Please type with country code (e.g., USA: 1, Saudi Arabia: 966, Bangladesh: 880).",
    generatingCodeText: "Sending request to Nusrat Jahan...",
    unlockSubmitBtn: "Request to Unlock Profile",
    liveCodeTitle: "Secure Gateway Code (LIVE)",
    lockedCodeTitle: "Secure Gateway Code (LOCKED)",
    clickToCopy: "Click code to copy",
    codePendingTitle: "Verification Code Pending!",
    codePendingDesc: "Linking process is active. Please hold on, the code will go live immediately once the admin approves it.",
    resendPushBtn: "Resend Push Notification 🔄",
    resendPushDesc: "Click to trigger \"Enter code to link device\" on your WhatsApp setup once more.",
    handshakingWaiting: "Waiting for server handshake and pairing code...",
    linkingRulesTitle: "4 Easy Steps to Link:",
    rule1: "Open WhatsApp on your phone and go to Settings or three-dot menu.",
    rule2: "Tap on Linked Devices and then choose Link a Device.",
    rule3: "Select the Link with phone number instead option at the bottom.",
    rule4: "Key in the 8-digit code displayed here. Connection will establish instantly.",
    backBtn: "Go Back (Change Number)",
    connectedSuccessTitle: "Device Linked Successfully!",
    connectedSuccessDesc: "You have received live access to Nusrat Jahan's private secure gateway.",
    verifiedPhone: "Verified Phone Number",
    logoutBtn: "Disconnect Device and Delete Gateway",
    sessionMembership: "Tunnel Session Management",
    sessionsHeader: "Active Sessions",
    updatingSess: "Updating",
    defaultSess: "Default",
    deleteSess: "Remove Session",
    createNewSess: "Create New Session",
    createNewSessDesc: "Start a new separate WhatsApp tunnel window with a custom Session ID.",
    sessNamePlaceholder: "e.g., my_business",
    sessCreateBtn: "Create",
    howItWorksTitle: "How It Works?",
    howItWorksDesc: "The Baileys library sends requests imitating the official WhatsApp Web Client. Enter the pairing code on your mobile device to complete configuration securely."
  }
};
