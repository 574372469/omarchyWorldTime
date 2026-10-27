// The bundled cities in the scripts that do not use the Latin alphabet.
// Omarchy's shell is translated through its own I18n catalogs; these are the
// city names those catalogs would carry. Zones missing here fall back to the
// English name in cities.json, which is also what every Latin-script locale
// reads.

type Names = [zhHans: string, zhHant: string, ja: string, ko: string];

const NAMES: Record<string, Names> = {
  "Pacific/Pago_Pago": ["帕果帕果", "帕果帕果", "パゴパゴ", "파고파고"],
  "Pacific/Honolulu": ["檀香山", "檀香山", "ホノルル", "호놀룰루"],
  "America/Anchorage": ["安克雷奇", "安克拉治", "アンカレッジ", "앵커리지"],
  "America/Los_Angeles": ["洛杉矶", "洛杉磯", "ロサンゼルス", "로스앤젤레스"],
  "America/Vancouver": ["温哥华", "溫哥華", "バンクーバー", "밴쿠버"],
  "America/Denver": ["丹佛", "丹佛", "デンバー", "덴버"],
  "America/Phoenix": ["凤凰城", "鳳凰城", "フェニックス", "피닉스"],
  "America/Mexico_City": ["墨西哥城", "墨西哥城", "メキシコシティ", "멕시코시티"],
  "America/Chicago": ["芝加哥", "芝加哥", "シカゴ", "시카고"],
  "America/New_York": ["纽约", "紐約", "ニューヨーク", "뉴욕"],
  "America/Toronto": ["多伦多", "多倫多", "トロント", "토론토"],
  "America/Bogota": ["波哥大", "波哥大", "ボゴタ", "보고타"],
  "America/Lima": ["利马", "利馬", "リマ", "리마"],
  "America/Halifax": ["哈利法克斯", "哈利法克斯", "ハリファックス", "핼리팩스"],
  "America/Caracas": ["加拉加斯", "卡拉卡斯", "カラカス", "카라카스"],
  "America/Santiago": ["圣地亚哥", "聖地牙哥", "サンティアゴ", "산티아고"],
  "America/Sao_Paulo": ["圣保罗", "聖保羅", "サンパウロ", "상파울루"],
  "America/Argentina/Buenos_Aires": [
    "布宜诺斯艾利斯",
    "布宜諾斯艾利斯",
    "ブエノスアイレス",
    "부에노스아이레스",
  ],
  "Atlantic/Cape_Verde": ["普拉亚", "培亞", "プライア", "프라이아"],
  "Atlantic/Reykjavik": ["雷克雅未克", "雷克雅維克", "レイキャビク", "레이캬비크"],
  "Europe/London": ["伦敦", "倫敦", "ロンドン", "런던"],
  "Africa/Accra": ["阿克拉", "阿克拉", "アクラ", "아크라"],
  "Europe/Lisbon": ["里斯本", "里斯本", "リスボン", "리스본"],
  "Europe/Paris": ["巴黎", "巴黎", "パリ", "파리"],
  "Europe/Berlin": ["柏林", "柏林", "ベルリン", "베를린"],
  "Europe/Madrid": ["马德里", "馬德里", "マドリード", "마드리드"],
  "Africa/Lagos": ["拉各斯", "拉哥斯", "ラゴス", "라고스"],
  "Europe/Rome": ["罗马", "羅馬", "ローマ", "로마"],
  "Africa/Cairo": ["开罗", "開羅", "カイロ", "카이로"],
  "Europe/Athens": ["雅典", "雅典", "アテネ", "아테네"],
  "Africa/Johannesburg": ["约翰内斯堡", "約翰尼斯堡", "ヨハネスブルグ", "요하네스버그"],
  "Europe/Kyiv": ["基辅", "基輔", "キーウ", "키이우"],
  "Europe/Moscow": ["莫斯科", "莫斯科", "モスクワ", "모스크바"],
  "Europe/Istanbul": ["伊斯坦布尔", "伊斯坦堡", "イスタンブール", "이스탄불"],
  "Africa/Nairobi": ["内罗毕", "奈洛比", "ナイロビ", "나이로비"],
  "Asia/Riyadh": ["利雅得", "利雅德", "リヤド", "리야드"],
  "Asia/Tehran": ["德黑兰", "德黑蘭", "テヘラン", "테헤란"],
  "Asia/Dubai": ["迪拜", "杜拜", "ドバイ", "두바이"],
  "Asia/Kabul": ["喀布尔", "喀布爾", "カブール", "카불"],
  "Asia/Karachi": ["卡拉奇", "喀拉蚩", "カラチ", "카라치"],
  "Asia/Kolkata": ["德里", "德里", "デリー", "델리"],
  "Asia/Kathmandu": ["加德满都", "加德滿都", "カトマンズ", "카트만두"],
  "Asia/Dhaka": ["达卡", "達卡", "ダッカ", "다카"],
  "Asia/Almaty": ["阿拉木图", "阿拉木圖", "アルマトイ", "알마티"],
  "Asia/Yangon": ["仰光", "仰光", "ヤンゴン", "양곤"],
  "Asia/Bangkok": ["曼谷", "曼谷", "バンコク", "방콕"],
  "Asia/Jakarta": ["雅加达", "雅加達", "ジャカルタ", "자카르타"],
  "Asia/Singapore": ["新加坡", "新加坡", "シンガポール", "싱가포르"],
  "Asia/Shanghai": ["上海", "上海", "上海", "상하이"],
  "Asia/Hong_Kong": ["香港", "香港", "香港", "홍콩"],
  "Australia/Perth": ["珀斯", "伯斯", "パース", "퍼스"],
  "Asia/Seoul": ["首尔", "首爾", "ソウル", "서울"],
  "Asia/Tokyo": ["东京", "東京", "東京", "도쿄"],
  "Australia/Darwin": ["达尔文", "達爾文", "ダーウィン", "다윈"],
  "Australia/Adelaide": ["阿德莱德", "阿得雷德", "アデレード", "애들레이드"],
  "Australia/Sydney": ["悉尼", "雪梨", "シドニー", "시드니"],
  "Australia/Brisbane": ["布里斯班", "布里斯本", "ブリスベン", "브리즈번"],
  "Pacific/Noumea": ["努美阿", "努美阿", "ヌメア", "누메아"],
  "Pacific/Auckland": ["奥克兰", "奧克蘭", "オークランド", "오클랜드"],
  "Pacific/Fiji": ["苏瓦", "蘇瓦", "スバ", "수바"],
  "Pacific/Apia": ["阿皮亚", "阿皮亞", "アピア", "아피아"],
  "Pacific/Kiritimati": ["基里蒂马蒂", "基里蒂馬蒂", "キリティマティ", "키리티마티"],
  "America/St_Johns": ["圣约翰斯", "聖約翰斯", "セントジョンズ", "세인트존스"],
  "Europe/Copenhagen": ["哥本哈根", "哥本哈根", "コペンハーゲン", "코펜하겐"],
  "Europe/Stockholm": ["斯德哥尔摩", "斯德哥爾摩", "ストックホルム", "스톡홀름"],
  "Europe/Oslo": ["奥斯陆", "奧斯陸", "オスロ", "오슬로"],
  "Europe/Amsterdam": ["阿姆斯特丹", "阿姆斯特丹", "アムステルダム", "암스테르담"],
  "Europe/Brussels": ["布鲁塞尔", "布魯塞爾", "ブリュッセル", "브뤼셀"],
  "Europe/Zurich": ["苏黎世", "蘇黎世", "チューリッヒ", "취리히"],
  "Europe/Vienna": ["维也纳", "維也納", "ウィーン", "빈"],
  "Europe/Warsaw": ["华沙", "華沙", "ワルシャワ", "바르샤바"],
  "Europe/Prague": ["布拉格", "布拉格", "プラハ", "프라하"],
  "Europe/Dublin": ["都柏林", "都柏林", "ダブリン", "더블린"],
  "Europe/Helsinki": ["赫尔辛基", "赫爾辛基", "ヘルシンキ", "헬싱키"],
};

const COLUMN: Record<string, 0 | 1 | 2 | 3> = {
  "zh-Hans": 0,
  "zh-Hant": 1,
  ja: 2,
  ko: 3,
};

/** The city's name in `lang`, or "" when this language has no entry. */
export function localizedCity(zone: string, lang: string): string {
  const col = COLUMN[lang];
  if (col === undefined) return "";
  return NAMES[zone]?.[col] ?? "";
}
