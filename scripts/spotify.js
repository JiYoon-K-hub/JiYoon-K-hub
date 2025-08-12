const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Spotify API 설정
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// 폰트와 스타일 설정 (여기서 커스터마이징!)
const STYLE_CONFIG = {
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  accentColor: '#1db954',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  fontSize: {
    title: '16px',
    artist: '14px',
    album: '12px'
  }
};

// Access Token 가져오기
async function getAccessToken() {
  try {
    console.log('🔑 Access Token 요청 중...');
    console.log('📋 Client ID:', CLIENT_ID ? `${CLIENT_ID.substring(0, 8)}...` : 'undefined');
    console.log('📋 Refresh Token:', REFRESH_TOKEN ? `${REFRESH_TOKEN.substring(0, 8)}...` : 'undefined');
    
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=refresh_token&refresh_token=' + REFRESH_TOKEN,
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✅ Access Token 발급 성공');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ 토큰 가져오기 실패:');
    console.error('   상태코드:', error.response?.status);
    console.error('   응답 데이터:', JSON.stringify(error.response?.data, null, 2));
    console.error('   오류 메시지:', error.message);
    return null;
  }
}

// 현재 재생 중인 곡 가져오기
async function getCurrentTrack(accessToken) {
  try {
    console.log('🎵 현재 재생 중인 곡 확인 중...');
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    console.log('📊 현재 재생 API 응답 상태:', response.status);
    
    if (response.status === 204) {
      console.log('ℹ️  현재 재생 중인 곡 없음 (204 응답)');
      return null;
    }
    
    if (response.data && response.data.item) {
      console.log('✅ 현재 재생 중인 곡 발견:');
      console.log(`   곡명: ${response.data.item.name}`);
      console.log(`   아티스트: ${response.data.item.artists[0].name}`);
      console.log(`   앨범 커버: ${response.data.item.album.images[0]?.url || '없음'}`);
      console.log(`   재생 상태: ${response.data.is_playing ? '재생 중' : '일시정지'}`);
      
      return {
        name: response.data.item.name,
        artist: response.data.item.artists[0].name,
        album: response.data.item.album.name,
        image: response.data.item.album.images[0]?.url,
        url: response.data.item.external_urls.spotify,
        isPlaying: response.data.is_playing
      };
    }
    
    console.log('ℹ️  응답은 왔지만 곡 데이터가 없음');
    return null;
  } catch (error) {
    console.error('❌ 현재 재생 곡 API 오류:');
    console.error('   상태코드:', error.response?.status);
    console.error('   응답 데이터:', JSON.stringify(error.response?.data, null, 2));
    console.error('   오류 메시지:', error.message);
    return null;
  }
}

// 최근 재생한 곡 가져오기
async function getRecentTrack(accessToken) {
  try {
    console.log('🕐 최근 재생한 곡 확인 중...');
    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    console.log('📊 최근 재생 API 응답 상태:', response.status);
    
    if (response.data.items && response.data.items.length > 0) {
      const track = response.data.items[0].track;
      console.log('✅ 최근 재생한 곡 발견:');
      console.log(`   곡명: ${track.name}`);
      console.log(`   아티스트: ${track.artists[0].name}`);
      console.log(`   앨범 커버: ${track.album.images[0]?.url || '없음'}`);
      console.log(`   재생 시간: ${response.data.items[0].played_at}`);
      
      return {
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        image: track.album.images[0]?.url,
        url: track.external_urls.spotify,
        isPlaying: false
      };
    }
    
    console.log('ℹ️  최근 재생한 곡이 없음');
    return null;
  } catch (error) {
    console.error('❌ 최근 재생 곡 API 오류:');
    console.error('   상태코드:', error.response?.status);
    console.error('   응답 데이터:', JSON.stringify(error.response?.data, null, 2));
    console.error('   오류 메시지:', error.message);
    return null;
  }
}

// 이미지를 Base64로 다운로드
async function downloadImageAsBase64(imageUrl) {
  try {
    console.log('🖼️  앨범 커버 다운로드 중...');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000 // 10초 타임아웃
    });
    
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    
    console.log('✅ 앨범 커버 다운로드 완료');
    console.log(`   크기: ${Math.round(response.data.length / 1024)}KB`);
    console.log(`   타입: ${mimeType}`);
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('❌ 이미지 다운로드 실패:', error.message);
    return null;
  }
}

// SVG 위젯 생성
async function generateSVG(track) {
  const width = 400;
  const height = 120;
  
  // 기본 상태 (곡이 없을 때)
  if (!track) {
    console.log('🎨 기본 위젯 생성 중 (곡 정보 없음)');
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${STYLE_CONFIG.backgroundColor}" rx="8"/>
        <text x="20" y="60" font-family="${STYLE_CONFIG.fontFamily}" font-size="16px" fill="${STYLE_CONFIG.textColor}">
          🎵 Not playing anything
        </text>
      </svg>
    `;
  }

  console.log('🎨 곡 정보 위젯 생성 중');
  console.log(`   곡명: ${track.name}`);
  console.log(`   상태: ${track.isPlaying ? '재생 중' : '최근 재생'}`);

  // 텍스트 길이 제한 함수
  const truncate = (str, length) => str.length > length ? str.substring(0, length) + '...' : str;
  
  const status = track.isPlaying ? '🎵 Now Playing' : '🎵 Recently Played';
  const statusColor = track.isPlaying ? STYLE_CONFIG.accentColor : '#888888';
  
  // 앨범 커버 처리
  let albumCoverElement = '';
  if (track.image) {
    try {
      const base64Image = await downloadImageAsBase64(track.image);
      if (base64Image) {
        albumCoverElement = `
          <defs>
            <clipPath id="albumCover">
              <rect x="15" y="15" width="90" height="90" rx="4"/>
            </clipPath>
          </defs>
          <image x="15" y="15" width="90" height="90" href="${base64Image}" clip-path="url(#albumCover)"/>
        `;
        console.log('✅ 앨범 커버 임베드 완료');
      } else {
        // 이미지 다운로드 실패 시 기본 플레이스홀더
        albumCoverElement = `
          <rect x="15" y="15" width="90" height="90" fill="#333" rx="4"/>
          <text x="60" y="65" text-anchor="middle" font-family="${STYLE_CONFIG.fontFamily}" font-size="30px" fill="#666">🎵</text>
        `;
      }
    } catch (error) {
      console.error('❌ 앨범 커버 처리 중 오류:', error.message);
      albumCoverElement = `
        <rect x="15" y="15" width="90" height="90" fill="#333" rx="4"/>
        <text x="60" y="65" text-anchor="middle" font-family="${STYLE_CONFIG.fontFamily}" font-size="30px" fill="#666">🎵</text>
      `;
    }
  } else {
    // 이미지가 없을 때 기본 플레이스홀더
    albumCoverElement = `
      <rect x="15" y="15" width="90" height="90" fill="#333" rx="4"/>
      <text x="60" y="65" text-anchor="middle" font-family="${STYLE_CONFIG.fontFamily}" font-size="30px" fill="#666">🎵</text>
    `;
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .bg { fill: ${STYLE_CONFIG.backgroundColor}; }
          .title { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.title}; fill: ${STYLE_CONFIG.textColor}; font-weight: bold; }
          .artist { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.artist}; fill: #cccccc; }
          .album { font-family: ${STYLE_CONFIG.fontFamily}; font-size: ${STYLE_CONFIG.fontSize.album}; fill: #888888; }
          .status { font-family: ${STYLE_CONFIG.fontFamily}; font-size: 12px; fill: ${statusColor}; }
          .link { cursor: pointer; }
        </style>
      </defs>
      
      <!-- 배경 -->
      <rect width="100%" height="100%" class="bg" rx="8"/>
      
      <!-- 앨범 커버 -->
      ${albumCoverElement}
      
      <!-- 곡 정보 -->
      <text x="120" y="25" class="status">${status}</text>
      <text x="120" y="45" class="title">${truncate(track.name, 25)}</text>
      <text x="120" y="65" class="artist">by ${truncate(track.artist, 25)}</text>
      <text x="120" y="85" class="album">${truncate(track.album, 30)}</text>
      
      <!-- 재생 중일 때 애니메이션 -->
      ${track.isPlaying ? `
        <circle cx="370" cy="25" r="4" fill="${STYLE_CONFIG.accentColor}">
          <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      
      <!-- 앨범 커버 테두리 (선택사항) -->
      <rect x="15" y="15" width="90" height="90" fill="none" stroke="#444" stroke-width="1" rx="4"/>
    </svg>
  `;
}

// 사용자 프로필 확인 (디버깅용)
async function getUserProfile(accessToken) {
  try {
    console.log('👤 사용자 프로필 확인 중...');
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    console.log('✅ 사용자 프로필:');
    console.log(`   이름: ${response.data.display_name}`);
    console.log(`   국가: ${response.data.country}`);
    console.log(`   제품: ${response.data.product}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ 사용자 프로필 오류:');
    console.error('   상태코드:', error.response?.status);
    return null;
  }
}

// 메인 함수
async function main() {
  console.log('🎵 Spotify 위젯 업데이트 시작...');
  console.log('📅 실행 시간:', new Date().toISOString());
  
  // 환경변수 확인
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다:');
    console.error('   CLIENT_ID:', CLIENT_ID ? '✅' : '❌');
    console.error('   CLIENT_SECRET:', CLIENT_SECRET ? '✅' : '❌');
    console.error('   REFRESH_TOKEN:', REFRESH_TOKEN ? '✅' : '❌');
    return;
  }
  
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('❌ Access Token을 가져올 수 없습니다. 프로세스를 중단합니다.');
    return;
  }
  
  // 사용자 프로필 확인 (API 연결 테스트)
  await getUserProfile(accessToken);
  
  // 현재 재생 중인 곡 먼저 확인
  console.log('\n--- 현재 재생 곡 확인 ---');
  let track = await getCurrentTrack(accessToken);
  
  // 없으면 최근 재생한 곡 가져오기
  if (!track) {
    console.log('\n--- 최근 재생 곡 확인 ---');
    track = await getRecentTrack(accessToken);
  }
  
  // 결과 요약
  console.log('\n--- 최종 결과 ---');
  if (track) {
    console.log('✅ 곡 정보 확보 성공');
    console.log(`🎵 ${track.artist} - ${track.name} (${track.isPlaying ? '재생 중' : '최근 재생'})`);
    console.log(`🖼️  앨범 커버: ${track.image ? '있음' : '없음'}`);
  } else {
    console.log('❌ 곡 정보를 가져올 수 없음');
  }
  
  // SVG 생성
  console.log('\n--- SVG 위젯 생성 ---');
  const svg = await generateSVG(track);
  
  // 파일 저장
  console.log('💾 파일 저장 중...');
  await fs.ensureDir('assets');
  await fs.writeFile('assets/spotify-widget.svg', svg);
  
  console.log('✅ Spotify 위젯이 업데이트되었습니다!');
  console.log('📁 저장 위치: assets/spotify-widget.svg');
  console.log('📅 완료 시간:', new Date().toISOString());
}

// 스크립트 실행
main().catch(error => {
  console.error('💥 예상치 못한 오류 발생:');
  console.error(error);
});
