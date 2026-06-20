# CONTEXT.md — Eluus

App de transporte por aplicativo (passageiro + motorista).

## Identidade
- **Nome:** Eluus
- **Pasta local:** `/Volumes/dp/Projetos/eluus/`
- **GitHub:** `danielpioneiro-sudo/eluus` (era `VouCom` antes de jun/2026)
- **Bundle ID iOS:** `app.eluus.app`
- **Package Android:** `app.eluus.app`

## Stack
- React Native + Expo (SDK 54 — migração para SDK 55 pendente)
- Firebase: Firestore, Auth, Functions, Hosting, Storage
- Google Maps API
- IAP: react-native-iap (apenas para motoristas — pacotes de créditos)
- Navegação: @react-navigation/bottom-tabs + native
- Expo AV, Expo Image, Expo Notifications, Expo Location

## Builds
| Plataforma | Versão | Build |
|---|---|---|
| iOS | 1.1.0 | 10 |
| Android | 1.1.0 | 9 |

## Status
- **App Store:** build 9 aprovado e publicado ✅
- Simulador quebrado no macOS 26 (vtable crash) — usar dispositivo físico
- Migração SDK 55 pendente (expo-av → expo-audio/video, react-native-iap → expo-iap)

## Deploy
- **iOS produção:** Xcode local → xcodebuild → Organizer → App Store Connect (nunca EAS Build)
- **Android:** EAS Build
- **Firebase Hosting:** `firebase deploy`

## Contas
- **Firebase:** projeto vinculado ao `danielpioneiro-sudo`
- **Google Cloud:** chaves de Maps em `.env` (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`)
- **Apple Developer:** conta pessoal (migração para empresa pendente)
- **GitHub:** `danielpioneiro-sudo/eluus`

## Firebase Hosting (site web vinculado ao app)
- **Firebase Project ID:** `voucom-285e0`
- **Deploy:** `firebase deploy`
- Rotas configuradas em `firebase.json`:

| Rota | Arquivo | Descrição |
|---|---|---|
| `/admin` | `public/admin.html` | Painel admin web (interface escura, laranja) |
| `/m` | `public/m.html` | Versão mobile web |
| `/download` | `public/download.html` | Página de download do app |
| `/privacidade` | `public/privacidade.html` | Política de privacidade |
| `/termos` | `public/termos.html` | Termos de uso |
| `/solicitar-exclusao` | `public/solicitar-exclusao.html` | Exclusão de conta (exigência Apple/Google) |
| `/consentimento-localizacao` | `public/consentimento-localizacao.html` | Consentimento de localização |

## Contas de teste
| Conta | E-mail | Senha | Tipo |
|---|---|---|---|
| Passageiro (Apple sandbox) | teste.apple@eluus.app | Eluus@2026 | passageiro (sem IAP) |
| Motorista (Apple sandbox) | daniel@gmail.com | ruti1634 | motorista (com IAP) |

## Regras importantes
- IAP existe APENAS para motoristas (pacotes de corridas)
- Simulador de referência: iPad Air 11-inch (M3) iOS 26.5
- Não usar EAS Build para produção iOS
- Testar no dispositivo físico via `npx expo run:ios --device` (cabo USB)

## Credenciais
As chaves e tokens ficam no arquivo de ambiente — leia antes de fazer qualquer alteração:
- `/Volumes/dp/Projetos/eluus/.env`
