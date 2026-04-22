// account_personas.family_canon に各キャラの canon を投入する one-off スクリプト。
// 011_family_canon.sql migration 適用後に実行すること。
//
// 使い方:
//   cd threads-hub && node --env-file=.env.local scripts/populate-family-canon.mjs
//
// --dry でデフォルトはドライラン。--go で実書込。

import { createClient } from "@supabase/supabase-js";

const DRY = !process.argv.includes("--go");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---- per-account canonical family ----

const KAWAUSO_CANON = {
  era_mode: "real_time_with_flashback",
  family: {
    mother: {
      role: "main_character",
      gender: "F",
      age_desc: "30代後半",
      occupation: "ワーママ（職業詳細は未定義）",
      traits: ["産後うつ経験あり", "夫とは家事分担バトル常態", "深夜スマホ族"],
    },
    daughter_1: {
      label: "上の子 / お姉ちゃん",
      gender: "F",
      birth_date: "2020-08-15",
      nickname: "娘（姉）",
      traits: [
        "保育園の年長（2026年4月進級）",
        "日常会話完全",
        "『お姉ちゃんでしょ』ワードに敏感",
        "下の子の面倒をある程度見れる",
      ],
    },
    daughter_2: {
      label: "下の子 / 妹ちゃん",
      gender: "F",
      birth_date: "2023-11-20",
      nickname: "娘（妹）",
      traits: [
        "保育園の1歳児→2歳児クラス進級",
        "単語〜二語文",
        "熱出しやすい（冬場は特に）",
        "イヤイヤ期",
        "夜泣きが残っている",
      ],
    },
    husband: {
      gender: "M",
      occupation: "会社員（出張のある仕事）",
      traits: [
        "朝から会議",
        "深夜愚痴には『で、どうしてほしい？』反応",
        "家事育児の主体性は低め（悪意はない）",
        "週によっては出張で不在",
      ],
    },
  },
  vocabulary_guards: {
    allowed_now: [
      "保育園",
      "お迎え",
      "保育園バッグ",
      "連絡帳",
      "お片付け",
      "着替え",
      "お風呂",
      "歯磨き",
      "ご飯",
      "夜泣き",
      "イヤイヤ期",
      "お絵かき",
      "絵本",
      "シール",
      "お昼寝",
      "熱",
      "鼻水",
      "ミルク",
      "離乳食",
      "ベビーカー",
      "抱っこ",
      "おむつ",
    ],
    "forbidden_until_2027-04-01": [
      "宿題",
      "ランドセル",
      "給食",
      "時間割",
      "教科書",
      "登校班",
      "担任",
      "1年生",
      "2年生",
      "小学校",
      "小学生",
      "校長",
      "校庭",
      "授業",
      "登校",
    ],
    "forbidden_until_2033-04-01": [
      "中学生",
      "中学校",
      "部活",
      "塾",
      "受験",
    ],
    transition_dates: {
      "2027-04-01": "姉 小1進級 → 宿題/ランドセル/担任解禁",
      "2028-04-01": "姉 小2",
      "2029-04-01": "妹 保育園→幼稚園or年少相当",
      "2030-04-01": "妹 年中",
      "2033-04-01": "姉 中1 → 部活/塾 解禁",
    },
  },
  era_policy: {
    default: "現在進行形8割（「昨日の夜」「今朝」等）",
    flashback_ok: "過去回想2割OK（「2年前の〇月〜」「娘が2歳の頃〜」等）",
    future: "未来予測は避ける（占い要素が混じる）",
  },
};

const RYUNOSUKE_CANON = {
  era_mode: "real_time_with_flashback",
  family: {
    self: {
      role: "main_character",
      gender: "M",
      age_desc: "20代後半〜30代前半",
      occupation: "エネルギーワーク発信者（元理系・データ寄り）",
      traits: [
        "独身設定",
        "家族言及は基本なし（母親を稀に回想で出す程度）",
        "実家は地方（祖母の話も稀に）",
      ],
    },
  },
  vocabulary_guards: {
    allowed_now: ["実家", "祖母", "母親"],
    // 家族言及が少ないキャラなので禁止リストは最小
  },
  era_policy: {
    default: "現在進行形8割（体験シェア型）",
    flashback_ok: "大学生時代・昔の職場時代への回想OK",
    future: "未来予測は避ける",
  },
};

const FUKUROU_CANON = {
  era_mode: "real_time_with_flashback",
  family: {
    self: {
      role: "main_character",
      gender: "F",
      age_desc: "30代後半",
      occupation: "元人事コンサル → 数秘キャリアラボ運営",
      traits: [
        "独身設定（配偶者・子の言及なし）",
        "元同僚・相談者エピソードは豊富",
        "前職の部下・面談事例が主なエピソード源",
      ],
    },
  },
  vocabulary_guards: {
    allowed_now: ["相談者", "前職", "元部下", "面談"],
  },
  era_policy: {
    default: "現在進行形（相談事例が主）",
    flashback_ok: "コンサル時代への回想OK",
    future: "未来予測は避ける（数秘は構造分解に徹する）",
  },
};

const PLAN = [
  { slug: "kawauso-kaasan",  canon: KAWAUSO_CANON },
  { slug: "ryunosuke-kun",   canon: RYUNOSUKE_CANON },
  { slug: "fukurou-sensei",  canon: FUKUROU_CANON },
];

// ---- execute ----

for (const p of PLAN) {
  const { data: acc, error: accErr } = await sb.from("accounts").select("id,slug").eq("slug", p.slug).single();
  if (accErr || !acc) {
    console.error(`[${p.slug}] account not found`);
    continue;
  }

  if (DRY) {
    console.log(`\n=== [DRY] ${p.slug} (${acc.id}) ===`);
    console.log("canon family keys:", Object.keys(p.canon.family || {}));
    console.log("vocab guards keys:", Object.keys(p.canon.vocabulary_guards || {}));
    continue;
  }

  const { error } = await sb
    .from("account_personas")
    .update({ family_canon: p.canon })
    .eq("account_id", acc.id);
  if (error) {
    console.error(`[${p.slug}] update failed:`, error.message);
    continue;
  }
  console.log(`✓ [${p.slug}] family_canon updated`);
}

if (DRY) console.log("\n>>> dry run. use --go to write.");
