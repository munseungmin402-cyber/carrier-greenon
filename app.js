// Carrier GreenON의 화면 이름을 한곳에서 관리합니다.
// 새 화면이 생기면 HTML의 data-view 값과 이 배열에 같은 이름을 추가하면 됩니다.
const VIEW_NAMES = ["home", "mission", "wallet", "reward", "my"];

const pageViews = document.querySelectorAll("[data-view]");
const navigationButtons = document.querySelectorAll("[data-view-target]");
const shortcutButtons = document.querySelectorAll("[data-go-view]");

// 실제 에어컨 API 대신 사용하는 초기 시뮬레이션 데이터입니다.
// Object.freeze로 원본이 실수로 바뀌지 않게 보호하고, 초기화할 때 복사해서 사용합니다.
const INITIAL_AIRCON_STATE = Object.freeze({
  power: true,
  mode: "냉방",
  temperature: 26,
  fan: "자동",
  usageMinutes: 90,
  filterHealth: 92,
  sensorError: false,
});

const AIRCON_MODES = ["냉방", "제습", "송풍"];
const FAN_LEVELS = ["자동", "약풍", "중풍", "강풍"];

// 화면에서 계속 바뀌는 값은 초기 데이터의 복사본으로 관리합니다.
let airconState = { ...INITIAL_AIRCON_STATE };

// 광주광역시청 인근 중심 좌표를 한곳에서 관리해 다른 지역으로 바꾸기 쉽게 구성합니다.
const WEATHER_LOCATION = Object.freeze({
  name: "광주광역시",
  latitude: 35.1595,
  longitude: 126.8526,
});

// 날씨 API를 불러오기 전이나 네트워크 오류 때 사용하는 광주광역시 샘플 데이터입니다.
// 실제 에어컨 상태와 달리 날씨는 공개 Open-Meteo API에서 갱신하며 API 키가 필요하지 않습니다.
const SAMPLE_WEATHER_STATE = Object.freeze({
  location: WEATHER_LOCATION.name,
  temperature: 28,
  apparentTemperature: 29,
  humidity: 54,
  weatherCode: 0,
  source: "sample",
  updatedAt: null,
});
const weatherConfig = window.GREENON_WEATHER_CONFIG || {};
const WEATHER_API_URL = weatherConfig.apiUrl || "https://api.open-meteo.com/v1/forecast";
const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
let weatherState = { ...SAMPLE_WEATHER_STATE };
let weatherRefreshTimer = null;

// 오늘의 미션 진행 상태와 목표 시간을 관리합니다.
// 목표 시간과 보상은 Supabase의 활성 미션을 읽은 뒤 최신 값으로 바뀝니다.
let MISSION_DURATION_MINUTES = 120;
const INITIAL_MISSION_STATE = Object.freeze({
  status: "idle",
  elapsedMinutes: 0,
  warning: "",
});

let missionState = { ...INITIAL_MISSION_STATE };

// 로그인한 사용자에게 속한 Supabase 프로필·포인트 내역을 화면용 객체로 변환해 보관합니다.
let MISSION_REWARD_POINTS = 300;
let walletState = {
  balance: 0,
  transactions: [],
};
let walletFilter = "all";

// 상품 이름·설명·가격은 Supabase rewards 테이블에서 읽습니다.
// 사진은 배포 안정성을 위해 확인한 원본을 프로젝트 자산으로 보관하고 visual 코드와 연결합니다.
let rewardProducts = [];

const REWARD_PRODUCT_IMAGES = Object.freeze({
  coffee: Object.freeze({
    src: "assets/rewards/starbucks-americano.jpg",
    alt: "스타벅스 아이스 카페 아메리카노 Tall 제품 사진",
  }),
  tumbler: Object.freeze({
    src: "assets/rewards/starbucks-tumbler.jpg",
    alt: "스타벅스 그린 텀블러 473ml 제품 사진",
  }),
  cookie: Object.freeze({
    src: "assets/rewards/sungsimdang-zero-cookie.jpg",
    alt: "성심당 제로쿠키 18개입 제품 사진",
  }),
  brush: Object.freeze({
    src: "assets/rewards/oral-b-io10.png",
    alt: "Oral-B iO Series 10 전동칫솔 제품 사진",
  }),
  fan: Object.freeze({
    src: "assets/rewards/carrier-circulator.jpg",
    alt: "캐리어 클라윈드 서큘레이터 KRFT-E006PRAW 제품 사진",
  }),
});

let rewardCategory = "ALL";
let rewardOrders = [];
let selectedRewardId = null;

// 임시 사용자 배열은 PHASE 8에서 제거했습니다. 인증 정보는 Supabase Auth만 관리합니다.
let currentUser = null;
let authMode = "signup";
let authSubscription = null;

const supabaseConfig = window.GREENON_SUPABASE_CONFIG || {};
const isSupabaseConfigured = Boolean(
  window.supabase?.createClient
    && supabaseConfig.url
    && supabaseConfig.publishableKey,
);

// 브라우저에서는 공개용 publishable key만 사용합니다.
// service_role이나 secret key는 이 클라이언트에 절대로 전달하지 않습니다.
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
  : null;

// 누적 적립 포인트를 기준으로 GREEN LEVEL을 계산합니다.
// 사용한 포인트가 있어도 이미 달성한 친환경 활동 레벨은 낮아지지 않습니다.
const GREEN_LEVELS = Object.freeze([
  {
    name: "SEED",
    minimumPoints: 0,
    icon: "●",
    message: "첫 미션을 성공하고 작은 새싹을 틔워 보세요.",
  },
  {
    name: "LEAF",
    minimumPoints: 300,
    icon: "◆",
    message: "친환경 냉방 습관이 싱그러운 잎으로 자랐어요.",
  },
  {
    name: "TREE",
    minimumPoints: 1000,
    icon: "♣",
    message: "꾸준한 실천으로 든든한 GREEN TREE가 되었어요.",
  },
]);

const weatherElements = {
  card: document.querySelector("#weather-card"),
  sourceBadge: document.querySelector("#weather-source-badge"),
  symbol: document.querySelector("#weather-symbol"),
  location: document.querySelector("#weather-location"),
  temperature: document.querySelector("#weather-temperature"),
  summary: document.querySelector("#weather-summary"),
  updatedTime: document.querySelector("#weather-updated-time"),
  refreshButton: document.querySelector("#weather-refresh-button"),
  missionGuide: document.querySelector("#weather-mission-guide"),
  missionBadge: document.querySelector("#weather-mission-badge"),
  missionTitle: document.querySelector("#weather-mission-title"),
  missionDescription: document.querySelector("#weather-mission-description"),
};

const airconElements = {
  homeCard: document.querySelector("#home-aircon-card"),
  homeSummary: document.querySelector("#home-aircon-summary"),
  homeDetail: document.querySelector("#home-aircon-detail"),
  deviceCard: document.querySelector("#aircon-device-card"),
  deviceDisplay: document.querySelector("#device-display"),
  powerBadge: document.querySelector("#power-badge"),
  conditionBanner: document.querySelector("#condition-banner"),
  conditionIcon: document.querySelector("#condition-icon"),
  conditionTitle: document.querySelector("#condition-title"),
  conditionMessage: document.querySelector("#condition-message"),
  updatedTime: document.querySelector("#updated-time"),
  powerValue: document.querySelector("#power-value"),
  modeValue: document.querySelector("#mode-value"),
  temperatureValue: document.querySelector("#temperature-value"),
  fanValue: document.querySelector("#fan-value"),
  usageValue: document.querySelector("#usage-value"),
  filterValue: document.querySelector("#filter-value"),
  filterGauge: document.querySelector("#filter-gauge"),
  filterStat: document.querySelector("#filter-stat"),
  powerControl: document.querySelector("#power-control"),
  modeControlLabel: document.querySelector("#mode-control-label"),
  temperatureControlValue: document.querySelector("#temperature-control-value"),
  fanControlLabel: document.querySelector("#fan-control-label"),
  sensorControl: document.querySelector("#sensor-control"),
  announcement: document.querySelector("#simulation-announcement"),
};

const missionElements = {
  card: document.querySelector("#today-mission-card"),
  stateBadge: document.querySelector("#mission-state-badge"),
  conditionItems: document.querySelectorAll("[data-mission-condition]"),
  elapsedTime: document.querySelector("#mission-elapsed-time"),
  progressTrack: document.querySelector("#mission-progress-track"),
  progressBar: document.querySelector("#mission-progress-bar"),
  feedback: document.querySelector("#mission-feedback"),
  feedbackIcon: document.querySelector("#mission-feedback-icon"),
  feedbackTitle: document.querySelector("#mission-feedback-title"),
  feedbackMessage: document.querySelector("#mission-feedback-message"),
  startButton: document.querySelector("#mission-start-button"),
  timeButton: document.querySelector("#mission-time-button"),
  homeCard: document.querySelector(".mission-preview"),
  homeTitle: document.querySelector("#mission-preview-title"),
  homeDescription: document.querySelector("#home-mission-description"),
  homeProgressBar: document.querySelector("#home-mission-progress-bar"),
  homeStatus: document.querySelector("#home-mission-status"),
  homeButtonLabel: document.querySelector("#home-mission-button-label"),
  walletButton: document.querySelector("#mission-wallet-button"),
  rewardPoints: document.querySelector("#mission-reward-points"),
  rewardLabel: document.querySelector("#mission-reward-label"),
};

const walletElements = {
  balance: document.querySelector("#wallet-balance"),
  balanceMessage: document.querySelector("#wallet-balance-message"),
  earnedTotal: document.querySelector("#wallet-earned-total"),
  usedTotal: document.querySelector("#wallet-used-total"),
  transactionCount: document.querySelector("#transaction-count"),
  transactionList: document.querySelector("#transaction-list"),
  emptyState: document.querySelector("#wallet-empty-state"),
  emptyTitle: document.querySelector("#wallet-empty-title"),
  emptyMessage: document.querySelector("#wallet-empty-message"),
  emptyButton: document.querySelector("#wallet-empty-action"),
  filterButtons: document.querySelectorAll("[data-wallet-filter]"),
};

const rewardElements = {
  shopBalance: document.querySelector("#shop-point-balance"),
  productCount: document.querySelector("#reward-product-count"),
  productGrid: document.querySelector("#reward-product-grid"),
  categoryButtons: document.querySelectorAll("[data-reward-category]"),
  orderCount: document.querySelector("#reward-order-count"),
  orderList: document.querySelector("#reward-order-list"),
  orderEmpty: document.querySelector("#reward-order-empty"),
  dialog: document.querySelector("#reward-detail-dialog"),
  dialogArt: document.querySelector("#reward-dialog-art"),
  dialogImage: document.querySelector("#reward-dialog-image"),
  dialogEmoji: document.querySelector("#reward-dialog-emoji"),
  dialogCategory: document.querySelector("#reward-dialog-category"),
  dialogTitle: document.querySelector("#reward-dialog-title"),
  dialogDescription: document.querySelector("#reward-dialog-description"),
  dialogPrice: document.querySelector("#reward-dialog-price"),
  dialogBalance: document.querySelector("#reward-dialog-balance"),
  purchaseFeedback: document.querySelector("#purchase-feedback"),
  purchaseFeedbackIcon: document.querySelector("#purchase-feedback-icon"),
  purchaseFeedbackTitle: document.querySelector("#purchase-feedback-title"),
  purchaseFeedbackMessage: document.querySelector("#purchase-feedback-message"),
  purchaseButton: document.querySelector("#reward-purchase-button"),
};

const userElements = {
  connectionBadge: document.querySelector("#auth-connection-badge"),
  welcomeDescription: document.querySelector("#auth-welcome-description"),
  authCard: document.querySelector("#auth-card"),
  dashboard: document.querySelector("#my-dashboard"),
  authTabs: document.querySelectorAll("[data-auth-mode]"),
  signupForm: document.querySelector("#signup-form"),
  loginForm: document.querySelector("#login-form"),
  signupName: document.querySelector("#signup-name"),
  signupEmail: document.querySelector("#signup-email"),
  signupPassword: document.querySelector("#signup-password"),
  signupPasswordConfirm: document.querySelector("#signup-password-confirm"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  feedback: document.querySelector("#auth-feedback"),
  feedbackIcon: document.querySelector("#auth-feedback-icon"),
  feedbackTitle: document.querySelector("#auth-feedback-title"),
  feedbackMessage: document.querySelector("#auth-feedback-message"),
  profileInitial: document.querySelector("#profile-initial"),
  profileName: document.querySelector("#profile-name"),
  profileEmail: document.querySelector("#profile-email"),
  profileLevelName: document.querySelector("#profile-level-name"),
  logoutButton: document.querySelector("#logout-button"),
  levelVisual: document.querySelector("#level-visual"),
  levelName: document.querySelector("#green-level-name"),
  levelMessage: document.querySelector("#green-level-message"),
  levelProgressLabel: document.querySelector("#level-progress-label"),
  levelProgressPoints: document.querySelector("#level-progress-points"),
  levelProgressTrack: document.querySelector("#level-progress-track"),
  levelProgressBar: document.querySelector("#level-progress-bar"),
  levelSteps: document.querySelectorAll("[data-green-level]"),
  reportMissionCount: document.querySelector("#report-mission-count"),
  reportEarnedPoints: document.querySelector("#report-earned-points"),
  reportOrderCount: document.querySelector("#report-order-count"),
  reportCoolingTime: document.querySelector("#report-cooling-time"),
  reportEnergySaving: document.querySelector("#report-energy-saving"),
  reportSummary: document.querySelector("#report-summary"),
};

/**
 * 분 단위 시간을 사용자가 읽기 쉬운 "1시간 30분" 형태로 바꿉니다.
 *
 * @param {number} minutes 누적 사용 시간(분)
 * @returns {string} 한글로 표시할 시간
 */
function formatUsageTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}분`;
  if (remainingMinutes === 0) return `${hours}시간`;

  return `${hours}시간 ${remainingMinutes}분`;
}

/**
 * 포인트 숫자에 천 단위 쉼표를 넣어 읽기 쉬운 문자열로 바꿉니다.
 *
 * @param {number} points 표시할 포인트
 * @returns {string} 천 단위 쉼표가 적용된 포인트
 */
function formatPoints(points) {
  return points.toLocaleString("ko-KR");
}

/** Open-Meteo가 제공하는 WMO 날씨 코드를 한글 상태와 아이콘으로 바꿉니다. */
function getWeatherPresentation(code) {
  if (code === 0) return { label: "맑음", symbol: "☀" };
  if ([1, 2].includes(code)) return { label: "대체로 맑음", symbol: "🌤" };
  if (code === 3) return { label: "흐림", symbol: "☁" };
  if ([45, 48].includes(code)) return { label: "안개", symbol: "🌫" };
  if (code >= 51 && code <= 57) return { label: "이슬비", symbol: "🌦" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: "비", symbol: "🌧" };
  }
  if ((code >= 71 && code <= 77) || [85, 86].includes(code)) {
    return { label: "눈", symbol: "🌨" };
  }
  if (code >= 95) return { label: "뇌우", symbol: "⛈" };
  return { label: "날씨 변화", symbol: "🌥" };
}

/**
 * 외부온도와 습도에 따라 오늘 미션을 실천하는 방법을 추천합니다.
 * DB의 실제 성공 조건(냉방·26~28°C·2시간)은 바꾸지 않아 서버 검증과 항상 일치합니다.
 */
function getWeatherMissionRecommendation() {
  const temperature = weatherState.temperature;
  const apparentTemperature = weatherState.apparentTemperature;
  const humidity = weatherState.humidity;

  if (temperature >= 33 || apparentTemperature >= 35) {
    return {
      badge: "폭염 주의",
      title: "무더운 날 집중 절전 냉방",
      description: `외부 ${Math.round(temperature)}°예요. 문을 닫고 26~28°C를 유지해 과도한 냉방을 줄여요.`,
      homeDescription: "무더운 날에도 26~28°C를 유지하는 집중 절전 미션이에요.",
      isAlert: true,
    };
  }

  if (humidity >= 70) {
    return {
      badge: "습도 맞춤",
      title: "습한 날 쾌적 절전 냉방",
      description: `습도 ${Math.round(humidity)}%예요. 냉방 모드와 자동풍으로 26~28°C를 유지해요.`,
      homeDescription: "습도가 높은 오늘은 자동풍과 권장온도로 쾌적하게 도전해요.",
      isAlert: false,
    };
  }

  if (temperature <= 24) {
    return {
      badge: "선선한 날",
      title: "필요할 때만 알뜰 냉방",
      description: `외부 ${Math.round(temperature)}°예요. 미션 중에는 권장온도를 지키고 불필요한 가동은 줄여요.`,
      homeDescription: "선선한 오늘은 필요한 시간만 알뜰하게 냉방해 보세요.",
      isAlert: false,
    };
  }

  return {
    badge: "날씨 맞춤",
    title: "오늘은 기본 절전 냉방",
    description: `외부 ${Math.round(temperature)}°·습도 ${Math.round(humidity)}%예요. 26~28°C 미션에 도전하기 좋아요.`,
    homeDescription: "오늘 날씨에 맞춰 26~28°C 에너지 세이브 냉방에 도전해요.",
    isAlert: false,
  };
}

/** 현재 날씨와 날씨별 미션 안내를 홈·미션 화면에 함께 표시합니다. */
function renderWeatherState() {
  const presentation = getWeatherPresentation(weatherState.weatherCode);
  const recommendation = getWeatherMissionRecommendation();
  const hasLiveData = weatherState.source === "live";

  weatherElements.symbol.textContent = presentation.symbol;
  weatherElements.location.textContent = `${weatherState.location}의 날씨`;
  weatherElements.temperature.textContent = `${Math.round(weatherState.temperature)}°`;
  weatherElements.summary.textContent = `${presentation.label} · 습도 ${Math.round(weatherState.humidity)}%`;
  weatherElements.sourceBadge.textContent = hasLiveData ? "실시간 날씨" : "샘플 데이터";
  weatherElements.sourceBadge.classList.toggle("is-live", hasLiveData);
  weatherElements.sourceBadge.classList.remove("is-loading");
  weatherElements.updatedTime.textContent = hasLiveData && weatherState.updatedAt
    ? `${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(weatherState.updatedAt)} 관측 · 10분마다 갱신`
    : "네트워크 오류 시 사용하는 광주광역시 샘플";

  weatherElements.card.classList.toggle("is-alert", recommendation.isAlert);
  weatherElements.missionGuide.classList.toggle("is-alert", recommendation.isAlert);
  weatherElements.missionBadge.textContent = recommendation.badge;
  weatherElements.missionTitle.textContent = recommendation.title;
  weatherElements.missionDescription.textContent = recommendation.description;

  if (missionState.status === "idle") {
    missionElements.homeDescription.textContent = recommendation.homeDescription;
  }
}

/**
 * 광주광역시 좌표의 현재 외부온도·체감온도·습도를 Open-Meteo에서 가져옵니다.
 * 8초 안에 응답하지 않거나 값이 올바르지 않으면 샘플 데이터로 안전하게 복구합니다.
 */
async function loadCurrentWeather() {
  weatherElements.refreshButton.disabled = true;
  weatherElements.card.setAttribute("aria-busy", "true");
  weatherElements.sourceBadge.textContent = "날씨 확인 중";
  weatherElements.sourceBadge.classList.add("is-loading");
  weatherElements.sourceBadge.classList.remove("is-live");

  const query = new URLSearchParams({
    latitude: String(WEATHER_LOCATION.latitude),
    longitude: String(WEATHER_LOCATION.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code",
    timezone: "Asia/Seoul",
    forecast_days: "1",
  });
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${WEATHER_API_URL}?${query}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Weather API ${response.status}`);

    const payload = await response.json();
    const current = payload.current;
    const values = [
      current?.temperature_2m,
      current?.relative_humidity_2m,
      current?.apparent_temperature,
      current?.weather_code,
    ];
    if (!values.every(Number.isFinite)) throw new Error("Weather API data is invalid");

    // Open-Meteo가 반환한 광주 현지 관측 시각을 표시하고, 값이 없을 때만 현재 시각을 사용합니다.
    const observedAt = current.time ? new Date(`${current.time}+09:00`) : new Date();
    weatherState = {
      location: WEATHER_LOCATION.name,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      weatherCode: current.weather_code,
      source: "live",
      updatedAt: Number.isNaN(observedAt.getTime()) ? new Date() : observedAt,
    };
  } catch (error) {
    console.warn("실시간 날씨를 불러오지 못해 샘플 데이터를 표시합니다.", error);
    weatherState = { ...SAMPLE_WEATHER_STATE };
  } finally {
    window.clearTimeout(timeoutId);
    weatherElements.refreshButton.disabled = false;
    weatherElements.card.removeAttribute("aria-busy");
    renderWeatherState();
    renderMissionState();
  }
}

/**
 * 누적 적립 포인트를 계산합니다.
 * 현재 잔액이 아니라 지금까지의 친환경 활동량으로 레벨을 정하기 위해 별도 합계를 사용합니다.
 *
 * @returns {number} 누적 적립 포인트
 */
function getTotalEarnedPoints() {
  return walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((total, transaction) => total + transaction.amount, 0);
}

/**
 * 누적 적립 포인트에 맞는 현재 GREEN LEVEL과 다음 단계를 찾습니다.
 *
 * @param {number} earnedPoints 누적 적립 포인트
 * @returns {{currentLevel: object, nextLevel: object|null, progress: number}} 레벨 계산 결과
 */
function getGreenLevelStatus(earnedPoints) {
  const currentLevel = [...GREEN_LEVELS]
    .reverse()
    .find((level) => earnedPoints >= level.minimumPoints) || GREEN_LEVELS[0];
  const currentIndex = GREEN_LEVELS.findIndex((level) => level.name === currentLevel.name);
  const nextLevel = GREEN_LEVELS[currentIndex + 1] || null;

  if (!nextLevel) {
    return { currentLevel, nextLevel: null, progress: 100 };
  }

  const levelRange = nextLevel.minimumPoints - currentLevel.minimumPoints;
  const pointsInLevel = earnedPoints - currentLevel.minimumPoints;
  const progress = Math.min(100, Math.round((pointsInLevel / levelRange) * 100));

  return { currentLevel, nextLevel, progress };
}

/**
 * 회원가입·로그인 탭 중 선택한 폼만 보여 줍니다.
 * 인증 오류 안내는 탭을 바꿀 때 초기화하여 이전 메시지가 남지 않게 합니다.
 *
 * @param {"signup"|"login"} nextMode 보여 줄 인증 화면
 */
function switchAuthMode(nextMode) {
  authMode = nextMode === "login" ? "login" : "signup";

  userElements.authTabs.forEach((button) => {
    const isSelected = button.dataset.authMode === authMode;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
  });

  userElements.signupForm.hidden = authMode !== "signup";
  userElements.loginForm.hidden = authMode !== "login";
  userElements.feedback.hidden = true;
  userElements.feedback.classList.remove("is-alert");
}

/**
 * 인증 결과를 정상 Blue 또는 오류 Red UI로 안내합니다.
 *
 * @param {"info"|"alert"} type 안내 종류
 * @param {string} title 안내 제목
 * @param {string} message 상세 안내
 */
function showAuthMessage(type, title, message) {
  userElements.feedback.hidden = false;
  userElements.feedback.classList.toggle("is-alert", type === "alert");
  userElements.feedbackIcon.textContent = type === "alert" ? "!" : "i";
  userElements.feedbackTitle.textContent = title;
  userElements.feedbackMessage.textContent = message;
}

function showAuthError(title, message) {
  showAuthMessage("alert", title, message);
}

/**
 * Supabase Auth 오류 코드를 사용자가 해결할 수 있는 한글 안내로 바꿉니다.
 * 로그인 오류에서는 계정 존재 여부를 구분하지 않아 개인정보 노출을 막습니다.
 *
 * @param {object} error Supabase Auth 오류
 * @param {"signup"|"login"} action 실행한 인증 동작
 * @returns {string} 사용자 안내 문구
 */
function getSupabaseAuthErrorMessage(error, action) {
  if (error?.code === "over_email_send_rate_limit") {
    return "인증 이메일 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.";
  }

  if (error?.code === "email_address_invalid") {
    return "실제로 메일을 받을 수 있는 이메일 주소인지 확인해 주세요.";
  }

  if (error?.code === "email_not_confirmed") {
    return "받은 편지함의 인증 링크를 누른 뒤 로그인해 주세요.";
  }

  if (action === "login") {
    return "이메일 인증 여부와 이메일·비밀번호를 다시 확인해 주세요.";
  }

  return "이메일이 이미 사용 중이거나 입력한 내용을 처리할 수 없는지 확인해 주세요.";
}

/**
 * DB의 영문 가상 에어컨 값을 기존 한글 UI 값으로 바꿉니다.
 * 실제 Carrier API 데이터가 아니라 사용자별 Supabase 시뮬레이션 데이터입니다.
 */
function mapAirconFromDatabase(row) {
  const modeMap = { cool: "냉방", dehumidify: "제습", fan: "송풍" };
  const fanMap = { auto: "자동", low: "약풍", medium: "중풍", high: "강풍" };

  return {
    power: row.power,
    mode: modeMap[row.mode] || "냉방",
    temperature: Number(row.temperature),
    fan: fanMap[row.fan] || "자동",
    usageMinutes: row.runtime_minutes,
    filterHealth: row.filter_percent,
    sensorError: !row.sensor_connected,
  };
}

/** DB에 저장할 때는 스키마가 사용하는 짧은 영문 코드로 되돌립니다. */
function mapAirconToDatabase() {
  const modeMap = { 냉방: "cool", 제습: "dehumidify", 송풍: "fan" };
  const fanMap = { 자동: "auto", 약풍: "low", 중풍: "medium", 강풍: "high" };

  return {
    user_id: currentUser.id,
    power: airconState.power,
    mode: modeMap[airconState.mode],
    temperature: airconState.temperature,
    fan: fanMap[airconState.fan],
    runtime_minutes: airconState.usageMinutes,
    filter_percent: airconState.filterHealth,
    sensor_connected: !airconState.sensorError,
    updated_at: new Date().toISOString(),
  };
}

/**
 * 로그인 여부와 무관하게 공개된 활성 미션·상품 카탈로그를 Supabase에서 읽습니다.
 * 소스코드에 임시 상품 배열을 두지 않아 관리자 데이터 변경도 새로고침 후 반영됩니다.
 */
async function loadCatalogData() {
  if (!supabaseClient) return;

  const [missionResult, rewardsResult] = await Promise.all([
    supabaseClient
      .from("missions")
      .select("id,title,description,reward_points,target_minutes")
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabaseClient
      .from("rewards")
      .select("id,category,name,description,price,visual,tag,emoji,stock")
      .eq("is_active", true)
      .order("created_at"),
  ]);

  if (!missionResult.error && missionResult.data) {
    MISSION_DURATION_MINUTES = missionResult.data.target_minutes;
    MISSION_REWARD_POINTS = missionResult.data.reward_points;
    missionElements.homeTitle.textContent = missionResult.data.title;
    missionElements.homeDescription.textContent = missionResult.data.description;
  }

  if (!rewardsResult.error) {
    rewardProducts = rewardsResult.data.map((product) => ({
      ...product,
      category: product.category.toUpperCase(),
    }));
    renderRewardShop();
  }
}

/** 로그아웃 시 이전 사용자의 개인 데이터가 화면에 남지 않도록 모두 비웁니다. */
function clearUserActivityData() {
  airconState = { ...INITIAL_AIRCON_STATE };
  missionState = { ...INITIAL_MISSION_STATE };
  walletState = { balance: 0, transactions: [] };
  rewardOrders = [];
  renderAirconState();
  renderMissionState();
  renderWallet();
  renderRewardShop();
  renderRewardOrders();
}

/** 로그인한 사용자에게 RLS로 허용된 자신의 활동 데이터만 병렬로 불러옵니다. */
async function loadAuthenticatedData(profile) {
  // Supabase의 current_date(UTC)로 저장된 참여 날짜와 같은 기준을 사용합니다.
  const today = new Date().toISOString().slice(0, 10);

  const [transactionsResult, missionResult, ordersResult, airconResult] = await Promise.all([
    supabaseClient
      .from("point_transactions")
      .select("id,transaction_type,amount,title,reference_type,reference_id,created_at")
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("user_missions")
      .select("id,status,progress_minutes,reward_granted,participation_date")
      .eq("participation_date", today)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseClient
      .from("reward_orders")
      .select("id,reward_id,price,status,created_at,rewards(name,emoji)")
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("aircon_status")
      .select("power,mode,temperature,fan,runtime_minutes,filter_percent,sensor_connected")
      .maybeSingle(),
  ]);

  const firstError = [transactionsResult, missionResult, ordersResult, airconResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  walletState = {
    balance: profile.point_balance,
    transactions: transactionsResult.data.map((transaction) => ({
      id: transaction.id,
      sourceId: `${transaction.reference_type || "transaction"}-${transaction.reference_id || transaction.id}`,
      type: transaction.transaction_type === "spend" ? "use" : "earn",
      amount: transaction.amount,
      title: transaction.title,
      description: transaction.reference_type === "reward_order" ? "GREEN REWARD 구매" : "26~28°C 에너지 세이브 냉방",
      createdAt: transaction.created_at,
    })),
  };

  const savedMission = missionResult.data;
  missionState = savedMission
    ? {
      status: savedMission.status === "active" ? "running" : savedMission.status,
      elapsedMinutes: savedMission.progress_minutes,
      warning: savedMission.status === "failed" ? "미션 조건을 유지하지 못해 오늘의 도전이 종료됐어요." : "",
    }
    : { ...INITIAL_MISSION_STATE };

  rewardOrders = ordersResult.data.map((order) => ({
    id: order.id,
    orderNumber: `GREEN-${order.id.slice(0, 8).toUpperCase()}`,
    productId: order.reward_id,
    productName: order.rewards?.name || "GREEN REWARD",
    price: order.price,
    emoji: order.rewards?.emoji || "🎁",
    createdAt: order.created_at,
  }));

  if (airconResult.data) airconState = mapAirconFromDatabase(airconResult.data);

  renderAirconState();
  renderMissionState();
  renderWallet();
  renderRewardShop();
  renderRewardOrders();
}

/** RPC 처리 뒤 DB를 다시 읽어 화면과 서버 값을 하나로 맞춥니다. */
async function refreshAuthenticatedData() {
  if (!currentUser || !supabaseClient) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("display_name,point_balance,total_points_earned,green_level")
    .eq("id", currentUser.id)
    .single();

  if (error) throw error;
  await loadAuthenticatedData(profile);
  renderMyPage();
}

/**
 * 현재 가상 에어컨 상태를 자신의 aircon_status 행에 저장합니다.
 * RLS가 user_id를 세션 사용자와 비교하므로 다른 사용자의 행은 수정할 수 없습니다.
 */
async function saveAirconStatus(validateMission = false) {
  if (!currentUser || !supabaseClient) return true;

  const { error } = await supabaseClient
    .from("aircon_status")
    .upsert(mapAirconToDatabase(), { onConflict: "user_id" });

  if (error) {
    airconElements.announcement.textContent = "가상 에어컨 상태를 저장하지 못했어요. 다시 시도해 주세요.";
    airconElements.announcement.classList.add("is-alert");
    return false;
  }

  if (validateMission && missionState.status === "running") {
    const { data, error: validationError } = await supabaseClient.rpc("validate_my_green_mission");
    if (validationError) return false;

    if (data.status === "failed") {
      missionState.status = "failed";
      missionState.elapsedMinutes = data.progressMinutes;
      missionState.warning = getMissionWarning() || "미션 조건을 유지하지 못했어요.";
      renderMissionState();
    }
  }

  return true;
}

/**
 * Supabase 세션 사용자의 프로필을 읽어 MY 화면에서 사용하는 단순 객체로 바꿉니다.
 * 표시 이름은 DB 프로필을 우선하고, 없으면 Auth metadata와 이메일 앞부분을 사용합니다.
 *
 * @param {object|null} session Supabase Auth 세션
 */
async function syncUserFromSupabaseSession(session) {
  if (!session?.user || !supabaseClient) {
    currentUser = null;
    clearUserActivityData();
    renderMyPage();
    return;
  }

  const authUser = session.user;
  const metadataName = authUser.user_metadata?.display_name
    || authUser.user_metadata?.full_name;
  let profileName = "";

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("display_name,point_balance,total_points_earned,green_level")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!error && profile?.display_name) {
    profileName = profile.display_name;
  }

  currentUser = {
    id: authUser.id,
    name: profileName || metadataName || authUser.email?.split("@")[0] || "GreenON 회원",
    email: authUser.email || "이메일 정보 없음",
    provider: "supabase",
  };

  try {
    await loadAuthenticatedData(profile || { point_balance: 0 });
  } catch (dataError) {
    console.error("사용자 데이터를 불러오지 못했습니다.", dataError);
    showAuthError("데이터를 불러오지 못했어요", "네트워크를 확인한 뒤 새로고침해 주세요.");
  }

  renderMyPage();
}

/**
 * 앱 시작 시 저장된 Supabase 세션을 복구하고 이후 로그인 상태 변화를 구독합니다.
 * Auth 이벤트 콜백 안에서는 비동기 DB 요청을 직접 기다리지 않고 다음 작업 큐로 넘깁니다.
 */
async function initializeSupabaseAuth() {
  if (!supabaseClient) {
    userElements.connectionBadge.textContent = "연결 오류";
    userElements.welcomeDescription.textContent = "Supabase 설정을 불러오지 못했어요. 연결을 확인한 뒤 새로고침해 주세요.";
    userElements.signupForm.querySelector("button[type='submit']").disabled = true;
    userElements.loginForm.querySelector("button[type='submit']").disabled = true;
    return;
  }

  userElements.connectionBadge.textContent = "Supabase 연결";
  userElements.welcomeDescription.textContent = "Supabase Auth로 회원가입하고 어느 기기에서든 안전하게 로그인할 수 있어요.";

  await loadCatalogData();

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showAuthError("로그인 상태를 확인하지 못했어요", "잠시 후 새로고침하거나 네트워크 연결을 확인해 주세요.");
  } else {
    await syncUserFromSupabaseSession(data.session);
  }

  const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      syncUserFromSupabaseSession(session);
    }, 0);
  });
  authSubscription = listener.subscription;
}

/**
 * 회원가입 폼을 검사한 뒤 Supabase Auth에 계정을 생성합니다.
 *
 * @param {SubmitEvent} event 폼 제출 이벤트
 */
async function registerUser(event) {
  event.preventDefault();

  const name = userElements.signupName.value.trim();
  const email = userElements.signupEmail.value.trim().toLowerCase();
  const password = userElements.signupPassword.value;
  const passwordConfirm = userElements.signupPasswordConfirm.value;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (name.length < 2) {
    showAuthError("이름을 확인해 주세요", "이름은 두 글자 이상 입력해 주세요.");
    return;
  }

  if (!isValidEmail) {
    showAuthError("이메일을 확인해 주세요", "green@example.com과 같은 이메일 형식으로 입력해 주세요.");
    return;
  }

  if (password.length < 6) {
    showAuthError("비밀번호가 너무 짧아요", "비밀번호를 6자 이상 입력해 주세요.");
    return;
  }

  if (password !== passwordConfirm) {
    showAuthError("비밀번호가 일치하지 않아요", "비밀번호 확인란에 같은 내용을 입력해 주세요.");
    return;
  }

  if (!supabaseClient) {
    showAuthError("Supabase 연결이 필요해요", "연결 설정을 확인한 뒤 새로고침해 주세요.");
    return;
  }

  const submitButton = userElements.signupForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Supabase에 가입 중...";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
    },
  });

  submitButton.disabled = false;
  submitButton.textContent = "회원가입하고 시작하기";

  if (error) {
    showAuthError(
      "회원가입을 완료하지 못했어요",
      getSupabaseAuthErrorMessage(error, "signup"),
    );
    return;
  }

  userElements.signupForm.reset();

  if (data.session) {
    await syncUserFromSupabaseSession(data.session);
    return;
  }

  switchAuthMode("login");
  showAuthMessage("info", "이메일 확인이 필요해요", "받은 편지함의 인증 링크를 누른 뒤 로그인해 주세요.");
}

/**
 * Supabase Auth의 이메일·비밀번호 방식으로 로그인합니다.
 *
 * @param {SubmitEvent} event 폼 제출 이벤트
 */
async function loginUser(event) {
  event.preventDefault();

  const email = userElements.loginEmail.value.trim().toLowerCase();
  const password = userElements.loginPassword.value;

  if (!supabaseClient) {
    showAuthError("Supabase 연결이 필요해요", "연결 설정을 확인한 뒤 새로고침해 주세요.");
    return;
  }

  const submitButton = userElements.loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Supabase 로그인 중...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitButton.disabled = false;
  submitButton.textContent = "로그인";

  if (error || !data.session) {
    showAuthError(
      "로그인 정보를 확인해 주세요",
      getSupabaseAuthErrorMessage(error, "login"),
    );
    return;
  }

  userElements.loginForm.reset();
  await syncUserFromSupabaseSession(data.session);
}

/**
 * Supabase의 현재 세션만 로그아웃하고 로그인 폼으로 돌아갑니다.
 */
async function logoutUser() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut({ scope: "local" });
  if (error) {
    showAuthError("로그아웃하지 못했어요", "잠시 후 다시 시도해 주세요.");
    return;
  }

  currentUser = null;
  clearUserActivityData();
  switchAuthMode("login");
  renderMyPage();
}

/**
 * 로그인 상태, GREEN LEVEL, GREEN REPORT를 현재 앱 활동 데이터에 맞춰 표시합니다.
 */
function renderMyPage() {
  const isLoggedIn = Boolean(currentUser);
  userElements.authCard.hidden = isLoggedIn;
  userElements.dashboard.hidden = !isLoggedIn;

  if (!isLoggedIn) return;

  const earnedPoints = getTotalEarnedPoints();
  const completedMissionCount = walletState.transactions.filter(
    (transaction) => transaction.type === "earn" && transaction.sourceId.startsWith("mission-"),
  ).length;
  const missionCoolingMinutes = completedMissionCount * MISSION_DURATION_MINUTES;
  const estimatedEnergySaving = completedMissionCount * 0.6;
  const { currentLevel, nextLevel, progress } = getGreenLevelStatus(earnedPoints);

  userElements.profileInitial.textContent = currentUser.name.charAt(0).toUpperCase();
  userElements.profileName.textContent = `${currentUser.name} 님`;
  userElements.profileEmail.textContent = currentUser.email;
  userElements.profileLevelName.textContent = currentLevel.name;
  userElements.levelVisual.textContent = currentLevel.icon;
  userElements.levelVisual.classList.toggle("is-leaf", currentLevel.name === "LEAF");
  userElements.levelVisual.classList.toggle("is-tree", currentLevel.name === "TREE");
  userElements.levelName.textContent = currentLevel.name;
  userElements.levelMessage.textContent = currentLevel.message;
  userElements.levelProgressBar.style.width = `${progress}%`;
  userElements.levelProgressTrack.setAttribute("aria-valuenow", String(progress));

  if (nextLevel) {
    userElements.levelProgressLabel.textContent = `다음 ${nextLevel.name}까지`;
    userElements.levelProgressPoints.textContent = `${formatPoints(earnedPoints)} / ${formatPoints(nextLevel.minimumPoints)} P`;
  } else {
    userElements.levelProgressLabel.textContent = "최고 레벨 달성";
    userElements.levelProgressPoints.textContent = `${formatPoints(earnedPoints)} P`;
  }

  userElements.levelSteps.forEach((step) => {
    const stepLevel = GREEN_LEVELS.find((level) => level.name === step.dataset.greenLevel);
    const isReached = earnedPoints >= stepLevel.minimumPoints;
    const isCurrent = stepLevel.name === currentLevel.name;
    step.classList.toggle("is-reached", isReached);
    step.classList.toggle("is-current", isCurrent);
  });

  userElements.reportMissionCount.textContent = String(completedMissionCount);
  userElements.reportEarnedPoints.textContent = `${formatPoints(earnedPoints)} P`;
  userElements.reportOrderCount.textContent = String(rewardOrders.length);
  userElements.reportCoolingTime.textContent = formatUsageTime(missionCoolingMinutes);
  userElements.reportEnergySaving.textContent = estimatedEnergySaving.toFixed(1);
  userElements.reportSummary.textContent = completedMissionCount > 0
    ? `${currentUser.name} 님은 ${completedMissionCount}개의 미션을 완료하고 ${formatPoints(earnedPoints)} P를 모았어요.`
    : "첫 GREEN MISSION을 완료하면 활동 리포트가 채워져요.";
}

/**
 * 거래 시각을 포인트 내역에 어울리는 짧은 한글 날짜로 표시합니다.
 *
 * @param {string} dateString ISO 형식의 거래 시각
 * @returns {string} 월·일·시·분 형식 날짜
 */
function formatTransactionDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

/**
 * 현재 잔액, 적립·사용 합계와 선택한 탭의 거래내역을 지갑 화면에 표시합니다.
 * 사용 내역이 없을 때는 GREEN REWARD SHOP으로 이동할 수 있는 안내를 보여 줍니다.
 */
function renderWallet() {
  const earnedTotal = walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const usedTotal = walletState.transactions
    .filter((transaction) => transaction.type === "use")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const filteredTransactions = walletState.transactions.filter(
    (transaction) => walletFilter === "all" || transaction.type === walletFilter,
  );

  walletElements.balance.textContent = formatPoints(walletState.balance);
  walletElements.earnedTotal.textContent = formatPoints(earnedTotal);
  walletElements.usedTotal.textContent = formatPoints(usedTotal);
  walletElements.balanceMessage.textContent = walletState.balance > 0
    ? "친환경 미션으로 모은 소중한 포인트예요."
    : "미션을 완료하면 포인트가 적립돼요.";
  walletElements.transactionCount.textContent = `${filteredTransactions.length}건`;

  walletElements.filterButtons.forEach((button) => {
    const isSelected = button.dataset.walletFilter === walletFilter;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
  });

  // 필터가 바뀔 때 이전 목록을 안전하게 비우고 현재 거래만 다시 만듭니다.
  walletElements.transactionList.replaceChildren();

  filteredTransactions.forEach((transaction) => {
    const item = document.createElement("li");
    const icon = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("small");
    const amount = document.createElement("div");
    const amountValue = document.createElement("strong");
    const date = document.createElement("small");

    item.className = `transaction-item is-${transaction.type}`;
    item.dataset.transactionId = transaction.id;
    icon.className = "transaction-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = transaction.type === "earn" ? "+" : "−";
    copy.className = "transaction-copy";
    title.textContent = transaction.title;
    description.textContent = transaction.description;
    amount.className = "transaction-amount";
    amountValue.textContent = `${transaction.type === "earn" ? "+" : "−"}${formatPoints(transaction.amount)} P`;
    date.textContent = formatTransactionDate(transaction.createdAt);

    copy.append(title, description);
    amount.append(amountValue, date);
    item.append(icon, copy, amount);
    walletElements.transactionList.append(item);
  });

  const isEmpty = filteredTransactions.length === 0;
  walletElements.emptyState.hidden = !isEmpty;
  walletElements.transactionList.hidden = isEmpty;

  if (!isEmpty) return;

  if (walletFilter === "earn") {
    walletElements.emptyTitle.textContent = "아직 적립 내역이 없어요";
    walletElements.emptyMessage.textContent = "GREEN MISSION을 성공하면 첫 적립 기록이 생겨요.";
    walletElements.emptyButton.textContent = "미션 도전하기";
    walletElements.emptyButton.dataset.goView = "mission";
    return;
  }

  if (walletFilter === "use") {
    walletElements.emptyTitle.textContent = "아직 사용 내역이 없어요";
    walletElements.emptyMessage.textContent = "GREEN REWARD SHOP에서 상품을 구매하면 사용 기록이 남아요.";
    walletElements.emptyButton.textContent = "리워드 상품 보기";
    walletElements.emptyButton.dataset.goView = "reward";
    return;
  }

  walletElements.emptyTitle.textContent = "아직 포인트 내역이 없어요";
  walletElements.emptyMessage.textContent = "GREEN MISSION을 성공하면 첫 적립 기록이 생겨요.";
  walletElements.emptyButton.textContent = "미션 도전하기";
  walletElements.emptyButton.dataset.goView = "mission";
}

/**
 * 선택한 카테고리에 맞는 리워드 상품 카드를 만듭니다.
 * 등록된 제품 사진이 없을 때만 DB의 emoji를 대체 이미지로 사용합니다.
 */
function renderRewardShop() {
  const visibleProducts = rewardProducts.filter(
    (product) => rewardCategory === "ALL" || product.category === rewardCategory,
  );

  rewardElements.shopBalance.textContent = formatPoints(walletState.balance);
  rewardElements.productCount.textContent = `${visibleProducts.length}개 상품`;

  rewardElements.categoryButtons.forEach((button) => {
    const isSelected = button.dataset.rewardCategory === rewardCategory;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
  });

  rewardElements.productGrid.replaceChildren();

  visibleProducts.forEach((product) => {
    const card = document.createElement("article");
    const art = document.createElement("div");
    const tag = document.createElement("span");
    const productImage = REWARD_PRODUCT_IMAGES[product.visual];
    const media = document.createElement(productImage ? "img" : "span");
    const content = document.createElement("div");
    const category = document.createElement("span");
    const name = document.createElement("h3");
    const footer = document.createElement("div");
    const price = document.createElement("strong");
    const detailButton = document.createElement("button");

    card.className = "reward-product-card";
    card.dataset.rewardProduct = product.id;
    art.className = `reward-product-art visual-${product.visual}`;
    tag.className = "reward-product-tag";
    tag.textContent = product.tag;
    if (productImage) {
      media.className = "reward-product-image";
      media.src = productImage.src;
      media.alt = productImage.alt;
      media.loading = "lazy";
      media.decoding = "async";
    } else {
      media.className = "reward-product-emoji";
      media.textContent = product.emoji;
      media.setAttribute("aria-hidden", "true");
    }
    content.className = "reward-product-content";
    category.className = "reward-product-category";
    category.textContent = product.category;
    name.textContent = product.name;
    footer.className = "reward-product-footer";
    price.className = "reward-product-price";
    price.textContent = `${formatPoints(product.price)} P`;
    detailButton.type = "button";
    detailButton.dataset.rewardProductId = product.id;
    detailButton.setAttribute("aria-label", `${product.name} 상세 보기`);
    detailButton.textContent = "상세 보기";

    art.append(tag, media);
    footer.append(price, detailButton);
    content.append(category, name, footer);
    card.append(art, content);
    rewardElements.productGrid.append(card);
  });
}

/**
 * 구매 완료된 리워드를 최신순으로 표시합니다.
 */
function renderRewardOrders() {
  rewardElements.orderCount.textContent = `${rewardOrders.length}건`;
  rewardElements.orderList.replaceChildren();

  rewardOrders.forEach((order) => {
    const item = document.createElement("li");
    const icon = document.createElement("span");
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    const orderNumber = document.createElement("small");
    const meta = document.createElement("div");
    const price = document.createElement("strong");
    const date = document.createElement("small");

    item.className = "reward-order-item";
    item.dataset.rewardOrder = order.id;
    icon.className = "reward-order-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = order.emoji;
    copy.className = "reward-order-copy";
    name.textContent = order.productName;
    orderNumber.textContent = `${order.orderNumber} · 교환 준비`;
    meta.className = "reward-order-meta";
    price.textContent = `−${formatPoints(order.price)} P`;
    date.textContent = formatTransactionDate(order.createdAt);

    copy.append(name, orderNumber);
    meta.append(price, date);
    item.append(icon, copy, meta);
    rewardElements.orderList.append(item);
  });

  const isEmpty = rewardOrders.length === 0;
  rewardElements.orderEmpty.hidden = !isEmpty;
  rewardElements.orderList.hidden = isEmpty;
}

/**
 * 상품 상세 모달을 열고 선택 상품과 현재 보유 포인트를 표시합니다.
 *
 * @param {string} productId 선택한 상품 ID
 */
function openRewardDetail(productId) {
  const product = rewardProducts.find((rewardProduct) => rewardProduct.id === productId);
  if (!product) return;

  selectedRewardId = product.id;
  rewardElements.dialog.classList.remove("has-warning");
  rewardElements.dialogArt.className = `reward-dialog-art visual-${product.visual}`;
  const productImage = REWARD_PRODUCT_IMAGES[product.visual];

  if (productImage) {
    rewardElements.dialogImage.src = productImage.src;
    rewardElements.dialogImage.alt = productImage.alt;
    rewardElements.dialogImage.hidden = false;
    rewardElements.dialogEmoji.hidden = true;
  } else {
    rewardElements.dialogImage.removeAttribute("src");
    rewardElements.dialogImage.alt = "";
    rewardElements.dialogImage.hidden = true;
    rewardElements.dialogEmoji.hidden = false;
    rewardElements.dialogEmoji.textContent = product.emoji;
  }
  rewardElements.dialogCategory.textContent = product.category;
  rewardElements.dialogTitle.textContent = product.name;
  rewardElements.dialogDescription.textContent = product.description;
  rewardElements.dialogPrice.textContent = formatPoints(product.price);
  rewardElements.dialogBalance.textContent = formatPoints(walletState.balance);
  rewardElements.purchaseFeedback.hidden = true;
  rewardElements.purchaseFeedback.classList.remove("is-alert", "is-success");
  rewardElements.purchaseButton.disabled = false;
  rewardElements.purchaseButton.textContent = "포인트로 구매하기";

  if (typeof rewardElements.dialog.showModal === "function") {
    rewardElements.dialog.showModal();
  } else {
    rewardElements.dialog.setAttribute("open", "");
  }
}

/**
 * 상품 구매 결과를 성공 Green 또는 포인트 부족 Red UI로 안내합니다.
 *
 * @param {"success"|"alert"} type 안내 상태
 * @param {string} title 안내 제목
 * @param {string} message 상세 안내
 */
function showPurchaseFeedback(type, title, message) {
  rewardElements.purchaseFeedback.hidden = false;
  rewardElements.purchaseFeedback.classList.toggle("is-success", type === "success");
  rewardElements.purchaseFeedback.classList.toggle("is-alert", type === "alert");
  rewardElements.purchaseFeedbackIcon.textContent = type === "success" ? "✓" : "!";
  rewardElements.purchaseFeedbackTitle.textContent = title;
  rewardElements.purchaseFeedbackMessage.textContent = message;
  rewardElements.dialog.classList.toggle("has-warning", type === "alert");
}

/**
 * 선택 상품 구매를 인증 사용자 전용 Supabase RPC로 처리합니다.
 * 포인트 차감·주문·거래내역은 DB의 한 트랜잭션 안에서 함께 성공하거나 함께 취소됩니다.
 */
async function purchaseSelectedReward() {
  const product = rewardProducts.find((rewardProduct) => rewardProduct.id === selectedRewardId);
  if (!product) return;

  if (!currentUser) {
    showPurchaseFeedback("alert", "로그인이 필요해요", "MY 화면에서 로그인한 뒤 구매해 주세요.");
    return;
  }

  if (walletState.balance < product.price) {
    const shortage = product.price - walletState.balance;
    showPurchaseFeedback(
      "alert",
      "GREEN POINT가 부족해요",
      `${formatPoints(shortage)} P를 더 모으면 이 상품을 구매할 수 있어요.`,
    );
    return;
  }

  rewardElements.purchaseButton.disabled = true;
  rewardElements.purchaseButton.textContent = "구매 처리 중...";

  const { error } = await supabaseClient.rpc("purchase_my_green_reward", {
    p_reward_id: product.id,
  });

  if (error) {
    rewardElements.purchaseButton.disabled = false;
    rewardElements.purchaseButton.textContent = "포인트로 구매하기";
    const isInsufficient = error.message?.includes("INSUFFICIENT_POINTS");
    showPurchaseFeedback(
      "alert",
      isInsufficient ? "GREEN POINT가 부족해요" : "구매를 완료하지 못했어요",
      isInsufficient ? "미션을 완료해 포인트를 더 모아 주세요." : "상품 상태를 확인한 뒤 다시 시도해 주세요.",
    );
    return;
  }

  await refreshAuthenticatedData();
  rewardElements.dialogBalance.textContent = formatPoints(walletState.balance);
  rewardElements.purchaseButton.disabled = true;
  rewardElements.purchaseButton.textContent = "구매 완료";
  showPurchaseFeedback(
    "success",
    "리워드 구매 완료!",
    `${formatPoints(product.price)} P가 차감되고 구매내역에 추가됐어요.`,
  );
}

/**
 * 센서와 필터 상태를 확인해 현재 화면에 표시할 안내 정보를 만듭니다.
 * 센서 오류가 가장 위험하므로 필터 경고보다 먼저 확인합니다.
 *
 * @returns {{isAlert: boolean, title: string, message: string}}
 */
function getAirconCondition() {
  if (airconState.sensorError) {
    return {
      isAlert: true,
      title: "센서 오류 감지",
      message: "온도 센서 데이터를 확인할 수 없어요.",
    };
  }

  if (airconState.filterHealth <= 20) {
    return {
      isAlert: true,
      title: "필터 점검 필요",
      message: "쾌적한 냉방을 위해 필터를 청소해 주세요.",
    };
  }

  if (!airconState.power) {
    return {
      isAlert: false,
      title: "전원이 꺼져 있어요",
      message: "시뮬레이션 패널에서 전원을 켤 수 있어요.",
    };
  }

  return {
    isAlert: false,
    title: "정상 운전 중",
    message: "모든 상태가 정상이에요.",
  };
}

/**
 * 시뮬레이션 데이터를 홈 요약 카드와 상세 화면에 동시에 반영합니다.
 * 데이터가 바뀔 때마다 이 함수만 호출하면 두 화면이 항상 같은 값을 보여 줍니다.
 */
function renderAirconState() {
  const condition = getAirconCondition();
  const powerLabel = airconState.power ? "ON" : "OFF";
  const detailLabel = airconState.power
    ? `${airconState.mode} ${airconState.temperature}° · ${airconState.fan}풍`
    : "전원이 꺼져 있어요";

  airconElements.homeSummary.textContent = condition.isAlert ? condition.title : airconState.power ? "정상 운전" : "전원 꺼짐";
  airconElements.homeDetail.textContent = condition.isAlert ? condition.message : detailLabel;
  airconElements.homeCard.classList.toggle("is-alert", condition.isAlert);

  airconElements.deviceCard.classList.toggle("is-alert", condition.isAlert);
  airconElements.deviceCard.classList.toggle("is-off", !airconState.power);
  airconElements.deviceDisplay.textContent = airconState.sensorError
    ? "--°"
    : airconState.power
      ? `${airconState.temperature}°`
      : "OFF";

  airconElements.powerBadge.innerHTML = `<span aria-hidden="true"></span> POWER ${powerLabel}`;
  airconElements.powerBadge.classList.toggle("is-off", !airconState.power);
  airconElements.conditionBanner.classList.toggle("is-alert", condition.isAlert);
  airconElements.conditionIcon.textContent = condition.isAlert ? "!" : "✓";
  airconElements.conditionTitle.textContent = condition.title;
  airconElements.conditionMessage.textContent = condition.message;

  airconElements.powerValue.textContent = powerLabel;
  airconElements.powerValue.closest(".aircon-stat").classList.toggle("is-off", !airconState.power);
  airconElements.modeValue.textContent = airconState.mode;
  airconElements.temperatureValue.textContent = airconState.sensorError ? "--" : airconState.temperature;
  airconElements.fanValue.textContent = airconState.fan;
  airconElements.usageValue.textContent = formatUsageTime(airconState.usageMinutes);
  airconElements.filterValue.textContent = airconState.filterHealth;
  airconElements.filterGauge.style.width = `${airconState.filterHealth}%`;
  airconElements.filterStat.classList.toggle("is-alert", airconState.filterHealth <= 20);

  airconElements.powerControl.classList.toggle("is-on", airconState.power);
  airconElements.powerControl.setAttribute("aria-pressed", String(airconState.power));
  airconElements.powerControl.querySelector("span").textContent = powerLabel;
  airconElements.modeControlLabel.textContent = airconState.mode;
  airconElements.temperatureControlValue.textContent = airconState.temperature;
  airconElements.fanControlLabel.textContent = airconState.fan;
  airconElements.sensorControl.classList.toggle("is-active", airconState.sensorError);
  airconElements.sensorControl.setAttribute("aria-pressed", String(airconState.sensorError));
  airconElements.updatedTime.textContent = "방금 업데이트";
}

/**
 * 현재 에어컨 상태가 오늘의 GREEN MISSION 조건을 만족하는지 항목별로 검사합니다.
 * 화면 표시와 실제 성공 판정이 같은 결과를 사용하도록 조건을 한 함수에 모았습니다.
 *
 * @returns {Array<{key: string, isMet: boolean, warning: string}>} 조건 검사 결과
 */
function getMissionConditions() {
  return [
    {
      key: "power",
      isMet: airconState.power,
      warning: "에어컨 전원이 꺼져 미션을 진행할 수 없어요.",
    },
    {
      key: "mode",
      isMet: airconState.mode === "냉방",
      warning: "운전 모드를 냉방으로 유지해 주세요.",
    },
    {
      key: "temperature",
      isMet: airconState.temperature >= 26 && airconState.temperature <= 28,
      warning: "설정온도를 26~28°C 범위로 맞춰 주세요.",
    },
    {
      key: "device",
      isMet: airconState.filterHealth > 20 && !airconState.sensorError,
      warning: airconState.sensorError
        ? "센서 오류가 감지되어 미션을 계속할 수 없어요."
        : "필터 점검이 필요해 미션을 계속할 수 없어요.",
    },
  ];
}

/**
 * 만족하지 못한 첫 번째 조건의 안내 문구를 반환합니다.
 * 모든 조건이 정상이라면 빈 문자열을 반환합니다.
 *
 * @returns {string} 사용자에게 보여 줄 조건 위반 안내
 */
function getMissionWarning() {
  const unmetCondition = getMissionConditions().find((condition) => !condition.isMet);
  return unmetCondition ? unmetCondition.warning : "";
}

/**
 * Supabase에서 읽은 미션 상태, 조건 목록, 진행률, 홈 요약을 한 번에 다시 그립니다.
 */
function renderMissionState() {
  const conditions = getMissionConditions();
  const progress = Math.min(100, Math.round((missionState.elapsedMinutes / MISSION_DURATION_MINUTES) * 100));
  const hasWarning = Boolean(missionState.warning) && missionState.status !== "success";

  missionElements.card.classList.toggle("is-running", missionState.status === "running");
  missionElements.card.classList.toggle("is-success", missionState.status === "success");
  missionElements.card.classList.toggle("is-failed", missionState.status === "failed");
  missionElements.card.classList.toggle("has-warning", missionState.status === "idle" && hasWarning);

  conditions.forEach((condition) => {
    const item = [...missionElements.conditionItems].find(
      (conditionItem) => conditionItem.dataset.missionCondition === condition.key,
    );

    item.classList.toggle("is-met", condition.isMet);
    item.classList.toggle("is-unmet", !condition.isMet);
    item.querySelector(":scope > span").textContent = condition.isMet ? "✓" : "!";
  });

  missionElements.elapsedTime.textContent = formatUsageTime(missionState.elapsedMinutes);
  missionElements.progressBar.style.width = `${progress}%`;
  missionElements.progressTrack.setAttribute("aria-valuenow", String(progress));
  missionElements.homeProgressBar.style.width = `${progress}%`;

  missionElements.feedback.classList.remove("is-alert", "is-success");
  missionElements.homeCard.classList.remove("is-failed", "is-success");
  missionElements.startButton.hidden = false;
  missionElements.walletButton.hidden = true;
  missionElements.rewardPoints.textContent = `+${MISSION_REWARD_POINTS} P`;
  missionElements.rewardLabel.textContent = "성공 예정 리워드";

  if (missionState.status === "running") {
    missionElements.stateBadge.textContent = "진행 중";
    missionElements.feedbackIcon.textContent = "▶";
    missionElements.feedbackTitle.textContent = "좋아요! 미션 진행 중";
    missionElements.feedbackMessage.textContent = "조건을 유지하고 시간 +30분 버튼을 눌러 주세요.";
    missionElements.startButton.textContent = "미션 진행 중";
    missionElements.startButton.disabled = true;
    missionElements.timeButton.disabled = false;
    missionElements.homeTitle.textContent = "GREEN MISSION 진행 중";
    missionElements.homeDescription.textContent = "냉방 조건을 유지하며 목표 시간에 도전하고 있어요.";
    missionElements.homeStatus.textContent = `진행 중 · ${progress}%`;
    missionElements.homeButtonLabel.textContent = "미션 계속하기";
    return;
  }

  missionElements.timeButton.disabled = true;

  if (missionState.status === "success") {
    missionElements.stateBadge.textContent = "미션 성공";
    missionElements.feedback.classList.add("is-success");
    missionElements.feedbackIcon.textContent = "✓";
    missionElements.feedbackTitle.textContent = "GREEN MISSION 성공!";
    missionElements.feedbackMessage.textContent = `+${formatPoints(MISSION_REWARD_POINTS)} P가 GREEN WALLET에 안전하게 적립됐어요.`;
    missionElements.startButton.textContent = "미션 성공 완료";
    missionElements.startButton.disabled = true;
    missionElements.startButton.hidden = true;
    missionElements.walletButton.hidden = false;
    missionElements.rewardLabel.textContent = "지급 완료";
    missionElements.homeCard.classList.add("is-success");
    missionElements.homeTitle.textContent = "오늘의 GREEN MISSION 성공!";
    missionElements.homeDescription.textContent = "친환경 냉방 습관으로 2시간 목표를 달성했어요.";
    missionElements.homeStatus.textContent = "성공 · 100%";
    missionElements.homeButtonLabel.textContent = "성공 결과 보기";
    return;
  }

  if (missionState.status === "failed") {
    missionElements.stateBadge.textContent = "미션 실패";
    missionElements.feedback.classList.add("is-alert");
    missionElements.feedbackIcon.textContent = "!";
    missionElements.feedbackTitle.textContent = "미션 조건을 유지하지 못했어요";
    missionElements.feedbackMessage.textContent = missionState.warning;
    missionElements.startButton.textContent = "다시 도전하기";
    missionElements.startButton.disabled = false;
    missionElements.homeCard.classList.add("is-failed");
    missionElements.homeTitle.textContent = "조건 위반으로 미션 실패";
    missionElements.homeDescription.textContent = "에어컨 상태를 정상으로 맞춘 뒤 다시 도전해 보세요.";
    missionElements.homeStatus.textContent = `실패 · ${progress}%에서 종료`;
    missionElements.homeButtonLabel.textContent = "미션 다시 도전";
    return;
  }

  missionElements.stateBadge.textContent = hasWarning ? "조건 확인" : "참여 전";
  missionElements.feedbackIcon.textContent = hasWarning ? "!" : "i";
  missionElements.feedbackTitle.textContent = hasWarning ? "조건을 먼저 맞춰 주세요" : "미션 참여 준비 완료";
  missionElements.feedbackMessage.textContent = hasWarning ? missionState.warning : "현재 모든 조건을 만족하고 있어요.";
  missionElements.feedback.classList.toggle("is-alert", hasWarning);
  missionElements.startButton.textContent = "미션 참여하기";
  missionElements.startButton.disabled = false;
  missionElements.homeTitle.textContent = "26~28°C 에너지 세이브 냉방";
  missionElements.homeDescription.textContent = hasWarning
    ? "미션 참여 전 에어컨 조건을 먼저 확인해 주세요."
    : getWeatherMissionRecommendation().homeDescription;
  missionElements.homeStatus.textContent = hasWarning ? "조건 확인 필요" : "참여 전 · 0%";
  missionElements.homeButtonLabel.textContent = "오늘의 미션 보기";
}

/**
 * 미션 참여를 시작하거나 실패한 오늘의 미션에 다시 도전합니다.
 * Supabase는 세션 사용자와 DB의 가상 에어컨 조건을 다시 검증합니다.
 */
async function startMission() {
  if (!currentUser) {
    missionState.warning = "MY 화면에서 로그인한 뒤 미션에 참여해 주세요.";
    renderMissionState();
    return;
  }

  const warning = getMissionWarning();

  if (warning) {
    missionState.warning = warning;
    renderMissionState();
    return;
  }

  const saved = await saveAirconStatus();
  if (!saved) return;

  const { error } = await supabaseClient.rpc("start_my_green_mission");
  if (error) {
    missionState.warning = error.message?.includes("AIRCON_CONDITION_NOT_MET")
      ? "현재 에어컨 상태가 미션 조건과 맞지 않아요."
      : "미션 참여 정보를 저장하지 못했어요. 다시 시도해 주세요.";
    renderMissionState();
    return;
  }

  await refreshAuthenticatedData();
}

/**
 * 미션 시간을 30분 진행합니다.
 * 조건이 정상일 때만 미션 시간과 가상 에어컨 사용시간을 함께 증가시킵니다.
 *
 */
async function advanceMissionTime() {
  if (missionState.status !== "running") return;

  const warning = getMissionWarning();
  if (warning) {
    await saveAirconStatus(true);
    return;
  }

  airconState.usageMinutes += 30;
  renderAirconState();

  const saved = await saveAirconStatus();
  if (!saved) {
    airconState.usageMinutes -= 30;
    renderAirconState();
    return;
  }

  const { error } = await supabaseClient.rpc("advance_my_green_mission");
  if (error) {
    airconElements.announcement.textContent = "미션 시간을 저장하지 못했어요. 다시 시도해 주세요.";
    airconElements.announcement.classList.add("is-alert");
    await refreshAuthenticatedData();
    return;
  }

  await refreshAuthenticatedData();
}

/**
 * 미션 진행 중 에어컨 상태가 바뀌면 즉시 조건을 다시 검사합니다.
 * +30분 조작은 조건이 맞을 때 미션 진행률도 함께 올립니다.
 *
 * @param {string} action 실행된 에어컨 시뮬레이션 동작
 */
async function syncMissionAfterAirconAction(action) {
  if (missionState.status !== "running") {
    // 참여 전에도 현재 조건의 Blue/Red 표시는 항상 최신 상태로 유지합니다.
    if (missionState.status === "idle") {
      missionState.warning = getMissionWarning();
    }
    renderMissionState();
    return;
  }

  const warning = getMissionWarning();
  if (warning) {
    missionState.status = "failed";
    missionState.warning = warning;
    renderMissionState();
    return;
  }

  renderMissionState();
}

/**
 * 같은 배열 안에서 현재 값의 다음 값을 찾아 모드나 바람 세기를 순환합니다.
 *
 * @param {string[]} values 선택 가능한 값 목록
 * @param {string} currentValue 현재 선택된 값
 * @returns {string} 다음 값
 */
function getNextValue(values, currentValue) {
  const currentIndex = values.indexOf(currentValue);
  return values[(currentIndex + 1) % values.length];
}

/**
 * 사용자가 어떤 조작을 했는지 읽고 가상 데이터만 변경합니다.
 * 실제 Carrier 기기나 외부 API에는 어떤 요청도 보내지 않습니다.
 *
 * @param {string} action 버튼의 data-aircon-action 값
 */
async function updateAirconState(action) {
  let announcement = "가상 에어컨 상태를 업데이트했어요.";

  switch (action) {
    case "power":
      airconState.power = !airconState.power;
      announcement = airconState.power ? "가상 에어컨 전원을 켰어요." : "가상 에어컨 전원을 껐어요.";
      break;
    case "mode":
      airconState.mode = getNextValue(AIRCON_MODES, airconState.mode);
      announcement = `운전 모드를 ${airconState.mode}(으)로 바꿨어요.`;
      break;
    case "temperature-down":
      airconState.temperature = Math.max(18, airconState.temperature - 1);
      announcement = `설정온도를 ${airconState.temperature}도로 바꿨어요.`;
      break;
    case "temperature-up":
      airconState.temperature = Math.min(30, airconState.temperature + 1);
      announcement = `설정온도를 ${airconState.temperature}도로 바꿨어요.`;
      break;
    case "fan":
      airconState.fan = getNextValue(FAN_LEVELS, airconState.fan);
      announcement = `바람 세기를 ${airconState.fan}(으)로 바꿨어요.`;
      break;
    case "add-time":
      if (airconState.power) {
        airconState.usageMinutes += 30;
        announcement = "가상 사용시간을 30분 추가했어요.";
      } else {
        announcement = "사용시간을 더하려면 먼저 전원을 켜 주세요.";
      }
      break;
    case "filter-wear":
      airconState.filterHealth = Math.max(0, airconState.filterHealth - 25);
      announcement = airconState.filterHealth <= 20
        ? "필터 수명이 낮아져 점검이 필요해요."
        : `필터 상태가 ${airconState.filterHealth}%로 변경됐어요.`;
      break;
    case "sensor-error":
      airconState.sensorError = !airconState.sensorError;
      announcement = airconState.sensorError ? "센서 오류 상태를 만들었어요." : "센서 상태를 정상으로 복구했어요.";
      break;
    case "reset":
      airconState = { ...INITIAL_AIRCON_STATE };
      announcement = "모든 가상 에어컨 상태를 초기값으로 되돌렸어요.";
      break;
    default:
      return;
  }

  renderAirconState();

  const condition = getAirconCondition();
  airconElements.announcement.textContent = announcement;
  airconElements.announcement.classList.toggle("is-alert", condition.isAlert);
  await saveAirconStatus(true);
  await syncMissionAfterAirconAction(action);
}

/**
 * 선택한 화면만 보여 주고 하단 내비게이션의 활성 상태를 함께 바꿉니다.
 * 구현되지 않은 화면은 안내 상태를, 구현된 화면은 실제 기능을 그대로 보여 줍니다.
 *
 * @param {string} viewName 보여 줄 화면의 이름
 * @param {boolean} updateHash 주소의 해시(#)도 함께 바꿀지 여부
 */
function showView(viewName, updateHash = true) {
  // 잘못된 화면 이름이 들어오면 사용자가 빈 화면을 보지 않도록 홈으로 이동합니다.
  const safeViewName = VIEW_NAMES.includes(viewName) ? viewName : "home";

  pageViews.forEach((view) => {
    const isSelected = view.dataset.view === safeViewName;

    view.hidden = !isSelected;
    view.classList.toggle("is-active", isSelected);
  });

  navigationButtons.forEach((button) => {
    const isSelected = button.dataset.viewTarget === safeViewName;

    button.classList.toggle("is-active", isSelected);

    // 스크린 리더가 현재 선택된 메뉴를 알 수 있도록 aria-current를 관리합니다.
    if (isSelected) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (updateHash) {
    window.history.replaceState(null, "", `#${safeViewName}`);
  }

  if (safeViewName === "my") {
    renderMyPage();
  }

  // 화면이 바뀔 때 상단부터 내용을 확인할 수 있게 이동합니다.
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 하단 내비게이션 버튼을 누르면 연결된 화면으로 이동합니다.
navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.viewTarget);
  });
});

// 홈 카드처럼 화면 안에 있는 바로가기 버튼도 같은 화면 전환 함수를 사용합니다.
shortcutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.goView);
  });
});

// 시뮬레이션 패널의 모든 버튼은 data-aircon-action 값으로 동작을 구분합니다.
// 버튼을 추가할 때마다 별도 이벤트 함수를 만들지 않아도 되어 초보자가 흐름을 따라가기 쉽습니다.
document.querySelectorAll("[data-aircon-action]").forEach((button) => {
  button.addEventListener("click", () => {
    updateAirconState(button.dataset.airconAction);
  });
});

// 미션 버튼도 data-mission-action 값으로 참여와 시간 진행 동작을 구분합니다.
document.querySelectorAll("[data-mission-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.missionAction === "start") {
      startMission();
      return;
    }

    if (button.dataset.missionAction === "advance") {
      advanceMissionTime();
    }
  });
});

// 포인트 내역 탭을 누르면 전체·적립·사용 기록 중 선택한 목록만 보여 줍니다.
walletElements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    walletFilter = button.dataset.walletFilter;
    renderWallet();
  });
});

// 리워드 카테고리 탭을 선택하면 해당 상품만 다시 표시합니다.
rewardElements.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    rewardCategory = button.dataset.rewardCategory;
    renderRewardShop();
  });
});

// 동적으로 생성되는 상품 카드의 상세 버튼은 상품 목록에서 한 번에 처리합니다.
rewardElements.productGrid.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-reward-product-id]");
  if (!detailButton) return;

  openRewardDetail(detailButton.dataset.rewardProductId);
});

// 상세 모달의 구매 버튼을 누르면 포인트 확인 후 구매를 처리합니다.
rewardElements.purchaseButton.addEventListener("click", purchaseSelectedReward);

rewardElements.dialog.addEventListener("close", () => {
  selectedRewardId = null;
  rewardElements.dialog.classList.remove("has-warning");
});

// 사용자가 새로고침 버튼을 누르면 같은 공개 API에서 최신 광주광역시 날씨를 다시 확인합니다.
weatherElements.refreshButton.addEventListener("click", loadCurrentWeather);

// 회원가입과 로그인 탭은 같은 MY 화면 안에서 필요한 폼만 보여 줍니다.
userElements.authTabs.forEach((button) => {
  button.addEventListener("click", () => {
    switchAuthMode(button.dataset.authMode);
  });
});

// 회원 정보는 임시 배열 없이 Supabase Auth에서만 생성하고 확인합니다.
userElements.signupForm.addEventListener("submit", registerUser);
userElements.loginForm.addEventListener("submit", loginUser);
userElements.logoutButton.addEventListener("click", logoutUser);

// 페이지가 닫힐 때 Auth 구독을 해제해 불필요한 이벤트 리스너가 남지 않게 합니다.
window.addEventListener("pagehide", () => {
  authSubscription?.unsubscribe();
  window.clearInterval(weatherRefreshTimer);
});

// 주소에 #mission처럼 화면 이름이 있으면 새로고침 후에도 해당 화면을 보여 줍니다.
const initialView = window.location.hash.replace("#", "");
showView(initialView || "home", false);

// 앱을 처음 열었을 때 샘플 날씨와 가상 에어컨 데이터를 즉시 보여 준 뒤 실시간 날씨를 요청합니다.
renderWeatherState();
renderAirconState();
renderWallet();
renderRewardShop();
renderRewardOrders();
renderMissionState();
switchAuthMode(authMode);
renderMyPage();
loadCurrentWeather();
// 앱을 계속 열어 둔 경우에도 광주광역시 현재 날씨가 오래된 값으로 남지 않게 자동 갱신합니다.
weatherRefreshTimer = window.setInterval(loadCurrentWeather, WEATHER_REFRESH_INTERVAL_MS);
initializeSupabaseAuth();
