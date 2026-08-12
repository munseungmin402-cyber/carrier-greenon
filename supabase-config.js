// 소스 저장소에는 실제 프로젝트 값을 작성하지 않습니다.
// production 빌드가 환경변수를 읽어 dist/supabase-config.js를 새로 생성합니다.
window.GREENON_SUPABASE_CONFIG = Object.freeze({
  url: "",
  publishableKey: "",
});

// 날씨 API는 비밀키가 필요 없으며, 빌드 환경변수로 다른 엔드포인트를 선택할 수 있습니다.
window.GREENON_WEATHER_CONFIG = Object.freeze({
  apiUrl: "https://api.open-meteo.com/v1/forecast",
});
