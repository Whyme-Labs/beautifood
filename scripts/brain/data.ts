// Synthetic guest questions for the intent model, written the way guests here type: English,
// Manglish, Malay and Chinese, with dish names, typos and particles filled in by the generator.
// The templates are the teacher's knowledge, distilled; the model learns to generalise past them.
// Placeholders: {d} {d2} a dish, {a} an allergen, {c} a course, {diet}, {n} {n2} a number, {p} a price.
import type { Intent } from "../../src/shared/brain/intentModel";
import type { Dish } from "../../src/server/ai/brain/understand";
import { readFileSync } from "node:fs";
import { hash } from "../../src/shared/brain/text";
import { trainingMenus } from "./menus";

export const TEMPLATES: Record<Intent, string[]> = {
  recommend: [
    "what are your best sellers", "your favourites?", "what do the regulars get", "what's the crowd favourite", "anything you'd recommend for a first visit", "what's the one dish i shouldn't miss",
    "what's delicious", "tasty food?", "good and cheap?", "affordable options", "something cheap", "value for money dish", "what's suitable for my kid", "what's good for children", "anything my baby can eat",
    "what can i eat that is not oily", "nothing too heavy", "nothing fried please", "something without meat", "food for a vegan friend", "options for my muslim friend", "what's safe for an egg allergy",
    "shellfish allergy, what can i have", "i avoid {a}", "allergic to {a} what is safe", "give me your top dishes", "top 3 dishes?", "pick something for me", "anything good?", "what's yummy",
    "what to try", "your pick?", "chef's recommendation", "house special", "specialty of the house", "list your {c}", "do you guys have {c}", "what kind of {c}", "{c} menu", "{c} got what",
    "paling sedap apa", "yang mana sedap", "apa yang power", "ada minuman sejuk", "ada pencuci mulut tak", "nak makan nasi", "nak makan mee", "yang tak berminyak",
    "推荐几道菜", "好吃的有哪些", "有什么好吃又便宜的", "适合小孩吃的", "有甜点吗", "有什么喝的", "不要油腻的", "想吃饭", "想吃面", "最出名的是什么", "有什么特色菜", "帮我选",
    "what's good here", "what do you recommend", "what should i order", "what should i eat", "any recommendations", "recommend me something", "what's your signature",
    "what's your signature dish", "what are you famous for", "what's the best dish", "what's the best thing on the menu", "must try?", "what's a must try here", "first time here, what should i get",
    "what's popular", "what do most people order", "surprise me", "i'm hungry, what's good", "something filling", "i'm starving", "i'm so hungry", "something light", "not very hungry",
    "i want something small", "anything healthy", "something healthy please", "something under {p}", "cheap options?", "what's the cheapest thing", "budget {p}", "anything below {p}",
    "something {diet}", "do you have {diet} options", "{diet} dishes?", "any {diet} food", "anything without {a}", "i'm allergic to {a}", "no {a} please", "i can't eat {a}",
    "{a} free options", "my son is allergic to {a}, what can he eat", "my wife can't have {a}, what's safe", "not spicy", "something not too spicy", "i love spicy food", "what's the spiciest dish",
    "something spicy", "anything for kids", "what can my toddler eat", "what {c} do you have", "show me your {c}", "any {c}?", "i want {c}", "something sweet", "what to drink",
    "anything to drink", "recommend a {c}", "{diet}, no {a}, under {p}", "something {diet} and not spicy", "{c} under {p}", "best {c} here?", "your best {c}", "which {c} do you recommend",
    "i feel like something spicy", "what's your most popular dish", "what's the chef's special", "anything special today", "what's nice", "i don't know what to eat", "help me choose",
    "what would you get", "what's worth ordering", "i want something with chicken", "anything with seafood", "something hot and soupy", "what's good for a cold day", "i'm craving noodles",
    "what can a vegetarian eat here", "is there anything halal", "halal food?", "options for someone with a {a} allergy", "gluten free stuff?", "dairy free options", "nut free please",
    "what's a good lunch", "quick bite?", "something i can eat fast", "what's light on the stomach", "i'm on a diet", "low calorie options", "what's the best value",
    "boss what's sedap here", "got what nice", "what's shiok here", "recommend lah", "got {diet} or not", "got {c} ah", "anything not pedas ah", "got cheap cheap one?",
    "wanna eat something spicy", "what u recommend ah", "best one which", "nice nice one got ah", "hungry already, what to eat", "what's the power one here", "which one confirm sedap",
    "got anything without {a} ah", "cannot eat {a} leh, what can", "kids cannot take spicy, got what", "below {p} got what", "want something cheap and good",
    "apa yang sedap", "ada cadangan", "nak makan apa", "apa yang best kat sini", "ada makanan tak pedas", "ada {diet} tak", "saya alergi {a}, boleh makan apa", "ada {c} apa",
    "nak minum apa", "yang murah ada", "bawah {p} ada apa", "nak yang pedas", "makanan ringan ada", "tak lapar sangat", "apa menu istimewa", "menu paling laku apa",
    "anak saya tak boleh makan pedas", "saya tak makan {a}", "ada makanan {diet}", "cadangkan sesuatu", "apa yang sedap untuk makan tengah hari",
    "有什么推荐", "招牌菜是什么", "什么好吃", "第一次来吃什么", "有没有素食", "有不辣的吗", "我对{a}过敏可以吃什么", "{p}以下有什么", "有什么{c}", "想吃辣的",
    "最便宜的是什么", "有什么清淡的", "我很饿", "给小孩吃的", "人气菜是什么", "推荐一下", "有什么特别的", "不要{a}", "有清真的吗", "吃什么好",
  ],
  dish_allergen: [
    "does {d} have {a}", "is there {a} in {d}", "does the {d} contain {a}", "{d} got {a} or not", "{d} ada {a} tak", "is {d} safe for someone allergic to {a}",
    "can i eat {d} if i'm allergic to {a}", "i'm allergic to {a}, can i have {d}", "what's in {d}", "what's in the {d}", "what are the ingredients of {d}", "{d} ingredients?",
    "any allergens in {d}", "is {d} {diet}", "is the {d} {diet}?", "is {d} gluten free", "{d} dairy free?", "is {d} nut free", "{d} boleh makan tak kalau alergi {a}",
    "my daughter is allergic to {a}, is {d} ok?", "{d} cooked with {a}?", "any {a} in the {d}?", "{d} pakai {a} ke", "does {d} use {a}", "{d} contains {a}?", "{d} has {a}?",
    "will the {d} have {a} in it", "allergens in the {d}?", "what allergens does {d} have", "is {d} ok for nut allergy", "is {d} suitable for vegetarians", "is the {d} halal",
    "can a vegan eat {d}", "{d} got pork?", "{d} ada babi tak", "{d} halal ke", "{d} ada udang ke", "is there egg in {d}", "does {d} come with {a}", "{d} made with {a}?",
    "can i have {d} without {a}", "can you make {d} without {a}", "{d} no {a} can?", "i can't eat {a}, is {d} fine", "{d} safe for kids with {a} allergy",
    "{d}有没有{a}", "{d}含{a}吗", "{d}可以给对{a}过敏的人吃吗", "{d}的成分是什么", "{d}是素的吗", "{d}有{a}吗", "我对{a}过敏，{d}可以吃吗", "{d}里面有什么",
    "{d}是清真的吗", "{d}有猪肉吗", "what's inside the {d}", "what goes into {d}", "{d} kandungan apa", "bahan dalam {d} apa",
  ],
  dish_info: [
    "price for {d}?", "cost of the {d}", "{d} price", "what's {d} like", "say more about {d}", "info on {d}", "details of the {d}", "what's so good about {d}", "why should i order {d}",
    "how much does the {d} cost", "{d} how much", "what's the {d} about", "can you describe the {d}", "what comes with the {d}", "{d} serves how many", "is {d} a big portion",
    "{d} harga berapa", "{d} macam mana", "{d}怎么样", "{d}贵吗", "说说{d}",
    "tell me about {d}", "what is {d}", "what's {d}", "describe {d}", "what's the story behind {d}", "history of {d}", "is {d} spicy", "how spicy is {d}", "how big is the {d}",
    "is the {d} good", "is {d} nice", "{d} sedap tak", "{d} tu apa", "apa itu {d}", "cerita pasal {d}", "how much is {d}", "price of {d}", "{d} berapa", "{d} how much ah",
    "{d}是什么", "介绍一下{d}", "{d}辣吗", "{d}多少钱", "{d}好吃吗", "{d} worth it?", "should i get the {d}", "what does {d} taste like", "{d} rasa macam mana",
    "{d} portion big or not", "{d}?", "{d}", "the {d}", "tell me more about the {d}", "what's special about {d}", "why is {d} your signature", "where does {d} come from",
    "is {d} filling", "is the {d} sweet", "{d} pedas tak", "{d} best ke", "how is the {d} cooked", "what kind of dish is {d}", "{d} is what ah", "explain {d}",
    "i've never had {d}, what is it", "{d} good or not", "{d}的故事", "{d}怎么做的", "{d}份量大吗", "how many pieces in {d}", "is {d} served hot", "{d} for one person enough?",
    "tell me about it", "what is that", "is it spicy", "how much is it", "is it good",
  ],
  compare: [
    "what's the difference between {d} and {d2}", "{d} vs {d2}", "{d} or {d2}?", "which is better, {d} or {d2}", "compare {d} and {d2}", "{d} or {d2}, which one should i get",
    "should i get {d} or {d2}", "is {d} spicier than {d2}", "{d} lagi sedap ke {d2}", "beza {d} dengan {d2}", "{d} dengan {d2} mana lagi best", "{d}和{d2}有什么区别",
    "{d}跟{d2}哪个好", "{d}还是{d2}", "how is {d} different from {d2}", "which is cheaper, {d} or {d2}", "{d} or {d2} for a first timer?", "torn between {d} and {d2}",
    "which one is spicier {d} or {d2}", "{d} versus {d2}", "difference {d} {d2}", "{d} and {d2} what's the difference", "can't decide between {d} and {d2}", "{d} or {d2} better ah",
    "which is more filling, {d} or {d2}", "{d} atau {d2}", "nak {d} ke {d2}", "{d}和{d2}哪个辣", "how does it compare to {d}", "is it better than {d}", "{d} better or {d2} better",
    "help me pick between {d} and {d2}", "{d} vs {d2} which is healthier", "between {d} and {d2}?",
  ],
  pairing: [
    "what to have with the {d}", "what do people eat with {d}", "anything to have with {d}", "add-ons for {d}?", "something on the side for {d}",
    "{d}, what drink", "{d}, what to drink", "{d} and what else", "i'll take the {d}, what drink", "best drink to go with {d}", "a side for {d}?",
    "what goes well with {d}", "what drink goes with {d}", "what should i drink with {d}", "what pairs with {d}", "something to go with my {d}", "what to order with {d}",
    "what side goes with {d}", "{d} best with what drink", "{d} sesuai minum apa", "minum apa dengan {d}", "apa yang sesuai dengan {d}", "{d}配什么好", "{d}配什么饮料",
    "吃{d}喝什么好", "dessert after {d}?", "anything to complement the {d}", "i'm getting {d}, what else should i add", "i ordered {d}, what drink would you suggest",
    "what goes with it", "what drink goes with that", "and to drink?", "what else goes with this", "with {d} what should i get", "{d} with what {c}", "which {c} goes with {d}",
    "what {c} pairs well with {d}", "good drink for {d}?", "i'm having the {d}, what to drink", "{d} paired with?", "what goes nice with {d} ah", "{d} makan dengan apa sedap",
    "nak order {d}, minum apa best", "{d}跟什么一起吃", "点了{d}，还要点什么", "what else to get with the {d}", "recommend a drink for the {d}", "{d} needs a side?",
    "what complements {d}", "what wine with {d}", "something to cool down after {d}", "{d} too spicy, what drink helps", "what's a good dessert after {d}",
  ],
  group: [
    "we are {n} people, what should we order", "we're {n}, what to share", "party of {n}, recommendations?", "what should {n} of us share", "{n} pax what to order",
    "table for {n}, what do you suggest", "we have {n} people with {p}", "{n} people {p} budget", "family of {n}, kids too", "what's good for sharing", "something to share",
    "we want to share a few dishes", "kami {n} orang, nak order apa", "{n} orang makan apa yang sesuai", "我们{n}个人点什么好", "{n}位吃什么", "适合分享的菜",
    "for {n} people what should we get", "{n} adults and {n2} kids", "group of {n}", "date night for two, what should we get", "for the two of us", "how many dishes for {n} people",
    "is it enough for {n}", "we are {n} pax, recommend", "{n} of us, all {diet}", "we're {n}, one is allergic to {a}", "order for {n} people under {p}", "feeding {n} people, what to get",
    "{n} people sharing, budget {p}", "family dinner for {n}", "lunch for {n} colleagues", "{n}个人一起吃，推荐几道菜", "我们一家{n}口吃什么", "{n} orang, bajet {p}",
    "what to order for a group", "big group, what do you recommend", "sharing plates for {n}?", "set for {n} people?",
  ],
  refine: [
    "which of those is the cheapest", "which one is cheapest", "and the cheapest one?", "which of these is not spicy", "any of those vegetarian", "which one is spicier",
    "which of them has no {a}", "of those which is best", "which is the most popular of these", "the first one", "which one would you pick", "mana satu paling murah",
    "yang mana paling sedap", "yang mana tak pedas", "那些里面哪个最便宜", "哪个比较辣", "这些哪个不辣", "哪一个最好", "which one's less spicy", "anything cheaper?",
    "something cheaper", "cheaper option?", "any without {a} from those", "which of them is {diet}", "out of those, which is best", "which one has no {a}", "and which is the mildest",
    "of these which is {diet}", "which one is the most filling", "which is the priciest", "which is most expensive of those", "the cheaper one", "ok which one cheapest", "among those, any not spicy",
    "which of them can kids eat", "which of those is halal", "and less spicy?", "anything less expensive", "yang tu mana paling best", "这些里面哪个是素的", "哪个最受欢迎",
  ],
  about: [
    "tell me about the restaurant", "what's this place about", "how long have you been open", "what's your story", "who owns this place", "what cuisine is this",
    "what kind of food do you serve", "cerita pasal kedai ni", "kedai ni dah lama ke", "你们餐厅的故事", "你们是什么菜", "这家店开多久了", "where are you from",
    "what's the history of this restaurant", "who's the chef", "is this a family business", "what's special about this restaurant", "how did you start", "what is this restaurant",
    "tell me about yourselves", "your story please", "since when you open ah", "siapa owner kedai ni", "你们的来历", "这家店有什么特色", "what makes you different",
  ],
  greeting: [
    "hello, quick question", "hey, are you there", "hi, i have a question", "excuse me", "hello?", "hi hi", "hai boss", "早上好", "晚上好", "在吗",
    "hi", "hello", "hey there", "good morning", "good evening", "good afternoon", "yo", "hai", "helo", "selamat pagi", "selamat petang", "assalamualaikum", "你好", "哈喽", "hi there!",
    "hello, can you help me?", "anyone there?", "hey bot", "start", "hi, i need help", "hello hello", "hey", "morning", "hi boss", "salam", "您好", "嗨", "can you help me choose?", "help",
  ],
  thanks: [
    "谢谢啦", "感谢", "好的谢谢", "cheers", "thanks mate", "appreciate it", "much appreciated", "ok i'll try that", "i'll go with that", "ok tq", "noted thanks",
    "thanks", "thank you", "thx", "tq", "terima kasih", "ok thanks", "great thanks", "perfect, thank you", "谢谢", "多谢", "cool", "ok", "okay got it", "awesome", "that's all",
    "nice one", "sounds good", "ok lah", "baik", "好的", "ok noted", "alright", "great", "perfect", "thanks a lot", "terima kasih banyak", "thank you so much", "谢啦", "no more questions", "got it",
  ],
  order_help: [
    "where is the washroom", "bathroom?", "wifi?", "can a waiter come over", "please send someone",
    "boleh tapau tak", "nak bungkus", "can i pack this", "takeaway box please", "my food hasn't come", "how long more for my food", "can i get a refill",
    "where do i pay", "can i pay here", "do you take cash", "e-wallet ok?", "结账", "洗手间在哪", "有wifi吗", "可以外带吗", "我的菜还没来", "请叫服务员",
    "how do i order", "how to order", "can i pay by card", "do you take credit card", "where's the toilet", "what's the wifi password", "can i get the bill", "call the waiter",
    "i need a staff", "how long is the wait", "can i book a table", "do you have parking", "can i takeaway", "do you deliver", "what time do you close", "opening hours?",
    "is there service charge", "can i change my order", "cancel my order", "where is my food", "my order is late", "can i get water", "need extra plates", "high chair for baby",
    "macam mana nak order", "boleh bayar kad", "tandas kat mana", "nak bil", "怎么点餐", "可以刷卡吗", "厕所在哪里", "买单", "wifi密码", "can i pay with touch n go",
    "do you accept duitnow", "how do i add to cart", "how to pay", "can i split the bill", "is my order coming", "can we sit outside", "can i bring my own cake", "do you open on sunday",
    "where to send the order", "can i order more", "i want to add an item", "remove an item from my order", "how do i call staff", "need chopsticks", "can i get a spoon",
    "how to use this", "boleh tapau", "pukul berapa tutup", "可以打包吗", "几点关门", "我要加单", "can i get the receipt", "is there a minimum order",
  ],
  out_of_scope: [
    "zxcvb", "aaaaa", "jjjjj", "123456", "...", "ok so", "what", "huh",
    "你几岁", "现在几点", "帮我写作业", "唱首歌", "今天新闻", "股票怎么样", "你喜欢我吗",
    "what's the weather", "tell me a joke", "who won the football", "write me a poem", "what is 2 plus 2", "who is the prime minister", "can you help me with my homework",
    "what's the bitcoin price", "are you chatgpt", "who made you", "what's the meaning of life", "recommend a movie", "how to cook at home", "translate this to french", "i'm bored",
    "do you love me", "sing a song", "where's the nearest atm", "what's the news today", "how is the weather in kl", "berapa harga minyak", "cuaca hari ini", "今天天气怎么样",
    "讲个笑话", "你是谁", "asdfgh", "lol", "hmm", "test", "testing 123", "what's your name", "are you a robot", "how old are you", "what time is it", "play some music",
    "book me a grab", "what's the exchange rate", "who is the best football player", "explain quantum physics", "what's your favourite colour", "can you code", "siapa kamu",
    "kau bot ke", "我的快递到哪了", "tell me a story", "what day is it today", "how do i get to klcc", "are you human", "write an essay", "what's trending",
  ],
};

export const FILLERS = {
  a: ["peanuts", "peanut", "nuts", "shellfish", "prawns", "shrimp", "seafood", "gluten", "wheat", "dairy", "milk", "eggs", "egg", "soy", "sesame", "fish", "crab", "squid", "kacang", "udang", "telur", "susu", "sotong", "ketam", "lactose", "cashews"],
  aZh: ["花生", "海鲜", "虾", "蛋", "牛奶", "坚果", "麸质", "芝麻", "鱼", "螃蟹"],
  diet: ["vegetarian", "vegan", "veggie", "halal", "plant based", "meatless", "vegetarian friendly", "halal friendly"],
  dietZh: ["素食", "纯素", "清真", "素"],
  c: ["drinks", "desserts", "noodles", "rice dishes", "sides", "snacks", "soups", "mains", "starters", "drink", "dessert", "noodle", "something sweet", "minuman", "pencuci mulut", "mee", "nasi", "beverages", "appetizers"],
  cZh: ["饮料", "甜品", "面", "饭", "小吃", "汤", "主菜"],
  p: ["RM10", "rm 15", "10 ringgit", "$12", "20", "RM8.50", "rm20", "RM 25", "30 bucks", "15"],
  pZh: ["20块", "RM15", "30令吉", "10元"],
  n: ["2", "3", "4", "5", "6", "8", "10", "two", "three", "four", "five", "six", "dua", "tiga", "empat", "lima"],
  nZh: ["2", "3", "4", "5", "两", "三", "四", "五", "六"],
};

/** Seeded PRNG (mulberry32), so a training run is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAN = /\p{Script=Han}/u;

/** How a guest might type a dish's name: in full, in lower case, a distinctive part of it, with a typo. */
function dishSurface(d: Dish, zh: boolean, r: () => number): string {
  if (zh && d.translations?.zh?.name && r() < 0.7) return d.translations.zh.name;
  const name = d.name.replace(/\(.*?\)/g, "").trim();
  const words = name.split(/\s+/);
  const x = r();
  if (x < 0.45) return name;
  if (x < 0.7) return name.toLowerCase();
  if (x < 0.85 && words.length > 1) return words[words.length - 1].toLowerCase() === "rice" || words[words.length - 1].length < 4 ? name.toLowerCase() : words.slice(-1)[0].toLowerCase();
  return typo(name.toLowerCase(), r);
}

function typo(s: string, r: () => number): string {
  const words = s.split(" ");
  const i = Math.floor(r() * words.length);
  const w = words[i];
  if (w.length < 5) return s;
  const j = 1 + Math.floor(r() * (w.length - 2));
  words[i] = r() < 0.5 ? w.slice(0, j) + w.slice(j + 1) : w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
  return words.join(" ");
}

const PREFIX = ["", "", "", "", "hi, ", "excuse me, ", "boss, ", "sorry, ", "can i ask, ", "hey ", "um ", "eh ", "bro ", "hello, ", "quick question, ", "auntie, "];
const SUFFIX = ["", "", "", "", "?", " please", " lah", " ah", " thanks", " leh", " ya", "??", "!", " pls", " ah?", " hor"];

/** Off-topic questions built from parts, so "not about the menu" covers more than the templates. */
const OFF_TOPIC = {
  ask: ["what is", "who is", "where is", "how do i", "can you", "tell me about", "explain", "why is", "when is", "how much is", "write", "find me", "show me"],
  thing: ["the capital of japan", "the president", "my phone bill", "a flight to bali", "the stock market", "python code", "a love letter", "the moon landing", "global warming", "my horoscope",
    "the football score", "a taxi", "the nearest hospital", "an essay on history", "the best laptop", "the lottery numbers", "a good book", "the time in london", "your creator", "a song",
    "the meaning of this word", "my email", "the train schedule", "the election", "a recipe for cake at home", "netflix", "the gym", "petrol price", "a hotel", "my car"],
  zh: ["今天几号", "附近有银行吗", "帮我订机票", "股市怎么样", "写一首诗", "你会说英语吗", "足球比分", "我的手机", "天气预报", "帮我翻译"],
};

function gibberish(r: () => number): string {
  const keys = "qwertyuiopasdfghjklzxcvbnm";
  const n = 3 + Math.floor(r() * 7);
  let s = "";
  for (let i = 0; i < n; i++) s += keys[Math.floor(r() * keys.length)];
  return r() < 0.3 ? `${s} ${s.slice(0, 3)}` : s;
}

export interface Example {
  text: string;
  intent: Intent;
  items: Dish[];
  /** Already as the model reads it (§dish, §num): harvested from real guests, labelled offline. */
  delex?: boolean;
}

/** Real guest questions the brain misread, labelled offline (scripts/brain/label.ts). */
export interface Harvested {
  /** As the intent model read it: dish names as §dish, numbers as §num. */
  text: string;
  intent: Intent;
}

export const HARVESTED: Harvested[] = JSON.parse(readFileSync(new URL("./harvested.json", import.meta.url), "utf8"));

/** Each real question counts this many times: there are few of them next to the templates. */
const HARVEST_WEIGHT = 3;

export function generate(perIntent: number, seed = 7): Example[] {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const menus = trainingMenus();
  const out: Example[] = [];
  for (const [intent, templates] of Object.entries(TEMPLATES) as [Intent, string[]][]) {
    for (let k = 0; k < perIntent; k++) {
      const tpl = pick(templates);
      const zh = HAN.test(tpl);
      const { items } = pick(menus);
      const d = pick(items);
      let d2 = pick(items);
      while (d2.id === d.id) d2 = pick(items);
      let text = tpl
        .replace("{d2}", dishSurface(d2, zh, r))
        .replace("{d}", dishSurface(d, zh, r))
        .replace("{a}", zh ? pick(FILLERS.aZh) : pick(FILLERS.a))
        .replace("{diet}", zh ? pick(FILLERS.dietZh) : pick(FILLERS.diet))
        .replace("{c}", zh ? pick(FILLERS.cZh) : pick(FILLERS.c))
        .replace("{p}", zh ? pick(FILLERS.pZh) : pick(FILLERS.p))
        .replace("{n2}", pick(FILLERS.n))
        .replace("{n}", zh ? pick(FILLERS.nZh) : pick(FILLERS.n));
      if (!zh && r() < 0.5) text = pick(PREFIX) + text + pick(SUFFIX);
      if (r() < 0.3) text = text.replace(/[?!,.']/g, "");
      if (r() < 0.15) text = typo(text, r);
      if (r() < 0.2) text = text.toUpperCase().startsWith(text[0]) ? text[0].toUpperCase() + text.slice(1) : text;
      out.push({ text, intent, items });
    }
  }
  for (let k = 0; k < perIntent * 0.4; k++) {
    const x = r();
    const text = x < 0.25 ? gibberish(r) : x < 0.4 ? pick(OFF_TOPIC.zh) : `${pick(OFF_TOPIC.ask)} ${pick(OFF_TOPIC.thing)}`;
    out.push({ text, intent: "out_of_scope", items: pick(menus).items });
  }
  for (const h of HARVESTED) for (let k = 0; k < HARVEST_WEIGHT; k++) out.push({ text: h.text, intent: h.intent, items: [], delex: true });
  // shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Changes whenever the templates, fillers or training menus do: the weights must be retrained then. */
export const dataHash = () => hash(JSON.stringify([TEMPLATES, FILLERS, OFF_TOPIC, trainingMenus(), HARVESTED])).toString(16);
