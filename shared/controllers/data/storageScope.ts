let storageScope = "";

/**
 * 브라우저 저장소 키를 로그인한 계정별로 나눈다. 호스팅 모드에서 앱을 그리기 전에 계정 ID로 한 번 설정한다.
 * 같은 브라우저에서 계정을 바꿔도 이전 계정의 캐시나 전송 대기열이 섞이지 않는다. 로컬 모드에서는 비워 두어 기존 키를 그대로 쓴다.
 */
export function setStorageScope(userId: string) {
  storageScope = userId;
}

export function scopedStorageKey(key: string) {
  return storageScope ? `${key}:${storageScope}` : key;
}

export function getStorageScope() {
  return storageScope;
}
