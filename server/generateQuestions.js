const fs = require('fs');

const truthTemplates = [
  "分享一個你從未告訴過任何人的關於{topic}的尷尬秘密。",
  "你對{person}做過最{adjective}的事情是什麼？",
  "如果你必須和{person}{action}，你會怎麼辦？",
  "你上一次{action}是什麼時候？因為什麼原因？",
  "你最害怕{topic}的什麼？",
  "如果今天是你地球上的最後一天，你最想跟{person}說什麼？",
  "你有沒有偷偷{action}過？",
  "如果現在必須放棄{item}，你會選哪一個？",
  "如果能回到過去，你最想改變關於{topic}的什麼事？",
  "你有沒有對{person}說過謊？是哪件事？",
  "你做過最叛逆的一件事是關於{topic}嗎？",
  "如果能跟{person}交換一天身份，你會去{action}嗎？",
  "你收過最瞎的{item}是什麼？是誰送的？",
  "你覺得在座的誰最可能去{action}？",
  "如果{person}向你表白，你會答應嗎？",
  "你曾因為{topic}而哭過嗎？",
  "你對{person}的第一印象是什麼？",
  "你做過最{adjective}的夢是關於{topic}嗎？",
  "如果給你一百萬去{action}，你會答應嗎？",
  "你人生中最{adjective}的時刻是什麼？"
];

const dareTemplates = [
  "用最{adjective}的語氣對著牆壁告白關於{topic}的事情一分鐘。",
  "對著通訊軟體上的{person}發送「我剛剛在路邊看到會飛的{item}」，並截圖。",
  "在房間內大聲朗讀你最近的一筆網購訂單商品清單，並解釋你買它為了{topic}的原因。",
  "模仿一隻喝醉的猩猩去{action}，維持 30 秒。",
  "現場做 10 個伏地挺身，並且每做一個都要大聲喊「我是{adjective}的人」！",
  "閉著眼睛讓{person}在你臉上畫一筆。",
  "選一個在座的人，深情對望 20 秒並說出關於{topic}的台詞。",
  "用屁股寫出{person}的名字。",
  "展示你手機裡最蠢的一張關於{topic}的照片。",
  "用方言或奇怪的腔調向大家介紹你最愛的{item}三分鐘。",
  "現在立刻去{action}，並維持 15 秒。",
  "假裝你是{person}，演繹一段他/她的經典動作。",
  "大聲唱一首關於{topic}的兒歌。",
  "讓左邊的人幫你選一個{item}當作道具，並表演一段情境劇。",
  "走到門口，對著外面大喊「我是一顆{adjective}的馬鈴薯！」",
  "在接下來的 5 輪中，每句話結尾都要加上「喵」。",
  "向右邊的人鞠躬，並誠懇地說「您是我見過最{adjective}的人」。",
  "把一件外套反穿，並走一段伸展台台步。",
  "喝一口水，然後含在嘴裡 30 秒不能吞下或吐出。",
  "用非慣用手畫一幅{person}的肖像畫。"
];

const topics = ["愛情", "工作", "童年", "校園", "家庭", "旅遊", "金錢", "朋友", "寵物", "食物", "未來", "過去", "外星人", "鬼怪", "科技", "夢想", "前任", "秘密", "謊言", "尷尬"];
const persons = ["前任", "初戀", "老闆", "在座的一位", "最好的朋友", "你的偶像", "陌生人", "父母", "兄弟姊妹", "老師", "鄰居", "小學同學", "初中同學", "高中同學", "大學同學", "同事", "客戶", "網友", "寵物", "未來的自己"];
const adjectives = ["浮誇", "尷尬", "搞笑", "荒謬", "可怕", "浪漫", "奇怪", "可愛", "瘋狂", "無聊", "愚蠢", "大膽", "做作", "悲傷", "開心", "憤怒", "緊張", "放鬆", "迷人", "討厭"];
const actions = ["偷吃宵夜", "裸奔", "唱歌", "跳舞", "告白", "睡覺", "發呆", "大笑", "哭泣", "打架", "逃跑", "撒嬌", "發脾氣", "吃蟲子", "跳海", "爬樹", "吃土", "穿女裝/男裝", "裝病", "辭職"];
const items = ["內褲", "臭襪子", "手機", "馬桶刷", "牙刷", "垃圾桶", "枕頭", "棉被", "錢包", "鑰匙", "鞋子", "眼鏡", "手錶", "戒指", "項鍊", "帽子", "圍巾", "手套", "襪子", "滑鼠"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const generateSet = (templates) => {
  const set = new Set();
  while(set.size < 500) {
    let text = getRandom(templates)
      .replace(/{topic}/g, getRandom(topics))
      .replace(/{person}/g, getRandom(persons))
      .replace(/{adjective}/g, getRandom(adjectives))
      .replace(/{action}/g, getRandom(actions))
      .replace(/{item}/g, getRandom(items));
    set.add(text);
  }
  return Array.from(set);
};

const questions = {
  truth: generateSet(truthTemplates),
  dare: generateSet(dareTemplates)
};

fs.writeFileSync('questions.json', JSON.stringify(questions, null, 2));
console.log('✅ 成功生成 questions.json，包含 1000 題 (Truth 500 題, Dare 500 題)');
