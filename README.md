# YTMusic Playlist Sorter

YouTube Music 플레이리스트에 정렬 기능을 추가하는 Tampermonkey 유저스크립트입니다.

## 기능

- 곡 제목 A→Z / Z→A 정렬
- 아티스트 순 정렬
- 앨범 순 정렬
- 아티스트+앨범 순 정렬 (아티스트로 묶고 그 안에서 앨범순)
- 곡 개별/전체 선택 가능
- 선택한 곡을 다른 재생목록에 추가
- 새 재생목록 생성 (공개 / 비공개 / 링크 공개 설정 가능)

## 설치 방법

1. Chrome 또는 Firefox에 [Tampermonkey](https://www.tampermonkey.net/) 확장앱 설치
2. Tampermonkey 대시보드 → 새 스크립트 만들기
3. `sort.js` 코드 전체 붙여넣기
4. Ctrl+S 로 저장

## 사용 방법

1. [YouTube Music](https://music.youtube.com) 접속
2. 정렬하고 싶은 플레이리스트 페이지로 이동
3. 우측 상단에 나타나는 버튼으로 정렬
4. 체크박스로 곡 선택 후 ➕ 재생목록에 추가 클릭

## 주의사항

- 정렬은 화면에만 적용됩니다. 새로고침하면 원래 순서로 돌아갑니다.
- 다른 재생목록에 추가하는 방식으로 정렬된 순서를 저장하는 것을 권장합니다.
- YouTube Music 업데이트에 따라 일부 기능이 동작하지 않을 수 있습니다.
