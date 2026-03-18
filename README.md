# 🚀 G7 Client Connector

Sistema completo de atendimento multi-canal com IA conversacional para gestão de condomínios e empresas.

## 📋 Visão Geral

**G7 Client Connector** é uma plataforma SaaS de atendimento ao cliente que integra WhatsApp, IA conversacional, gestão de protocolos e automação de processos.

**URL Produção:** https://wappal-connect.vercel.app

---

## ✨ Principais Funcionalidades

- 📱 **Integração WhatsApp** via Z-API
- 🤖 **IA Conversacional** com Groq/Gemini
- 📊 **Sistema de Protocolos** automatizado
- 💬 **Interface de Atendimento** em tempo real
- 👥 **Gestão de Participantes** e condomínios
- 🎵 **Player de Áudio** customizado
- 🔐 **Autenticação** segura
- 🎨 **Interface Responsiva** (mobile + desktop)

---

## 🛠️ Tecnologias

### Frontend
- **React** + **TypeScript** + **Vite**
- **Shadcn UI** + **Tailwind CSS**
- **React Router** + **React Hook Form**
- **Lucide Icons**

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Edge Functions** (Deno)
- **Realtime** subscriptions

### Integrações
- **Z-API** (WhatsApp)
- **Groq** (IA + Transcrição)
- **Asana** (Gestão de tarefas)
- **Google Calendar** (planejado)

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ ([instalar com nvm](https://github.com/nvm-sh/nvm))
- Conta Supabase
- Conta Z-API (WhatsApp)
- Conta Groq (IA)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/EMachadoP/wappal-connect.git
cd wappal-connect

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Inicie o servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📁 Estrutura do Projeto

```
wappal-connect/
├── src/
│   ├── components/          # Componentes React
│   │   ├── inbox/          # Chat e conversas
│   │   ├── layout/         # Layout e navegação
│   │   ├── profile/        # Perfil e configurações
│   │   └── ui/             # Componentes UI (Shadcn)
│   ├── pages/              # Páginas principais
│   ├── hooks/              # Custom hooks
│   ├── integrations/       # Integrações (Supabase)
│   └── lib/                # Utilitários
├── supabase/
│   ├── functions/          # Edge Functions
│   └── migrations/         # Migrations SQL
└── public/                 # Assets estáticos
```

---

## 🔧 Edge Functions

| Função | Descrição |
|--------|-----------|
| `zapi-webhook` | Recebe mensagens do WhatsApp |
| `zapi-send-message` | Envia mensagens |
| `transcribe-audio` | Transcreve áudios |
| `store-media` | Armazena mídias permanentemente |
| `ai-maybe-reply` | Decide quando IA responde |
| `ai-generate-reply` | Gera respostas da IA |
| `protocol-opened` | Cria protocolos |
| `assign-conversation` | Atribui conversas |
| `create-agent` | Cria agentes |

### Deploy de Edge Functions

```bash
# Deploy individual
npx supabase functions deploy function-name

# Deploy todas
npx supabase functions deploy
```

---

## 📊 Database Schema

### Principais Tabelas

- `conversations` - Conversas
- `messages` - Mensagens
- `contacts` - Contatos WhatsApp
- `participants` - Participantes identificados
- `entities` - Condomínios/empresas
- `protocols` - Protocolos de atendimento
- `profiles` - Perfis de usuários
- `ai_settings` - Configurações de IA
- `zapi_settings` - Configurações Z-API

### Migrations

```bash
# Aplicar migrations
npx supabase db push

# Criar nova migration
npx supabase migration new migration_name
```

---

## 🎨 UI Components

Baseado em **Shadcn UI** + **Tailwind CSS**:

- Buttons, Inputs, Modals
- Dropdowns, Tooltips
- Badges, Avatars
- Skeletons, Loading states
- Toast notifications

---

## 🔒 Autenticação

- **Supabase Auth** com JWT
- **Row Level Security (RLS)**
- Recuperação de senha
- Alteração de senha

---

## 📱 Responsividade

- ✅ Desktop (1920x1080+)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667+)

---

## 🧪 Testes

```bash
# Executar testes
npm test

# Executar com coverage
npm run test:coverage
```

---

## 📦 Deploy

### Vercel (Frontend)

```bash
# Deploy automático via GitHub
git push origin main

# Deploy manual
vercel --prod
```

### Supabase (Backend)

Edge Functions são deployadas automaticamente via CLI.

---

## 📚 Documentação

- [Resumo Completo](./SAAS_SUMMARY.md) - Visão geral detalhada
- [Roadmap](./ROADMAP.md) - Melhorias planejadas
- [Walkthroughs](./docs/) - Documentação de features

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📝 Changelog

### v1.0.0 (2026-01-05)

- ✅ Integração WhatsApp completa
- ✅ IA conversacional
- ✅ Sistema de protocolos
- ✅ Player de áudio customizado
- ✅ Gestão de participantes
- ✅ Interface responsiva

---

## 📄 Licença

Proprietary - G7 Client Connector

---

## 👥 Equipe

**Desenvolvedor:** Eldon Machado  
**Empresa:** G7 Client Connector

---

## 🆘 Suporte

- **Email:** suporte@g7connect.com
- **WhatsApp:** +55 (XX) XXXXX-XXXX
- **Documentação:** https://docs.g7connect.com

---

**Última Atualização:** 2026-01-05  
**Versão:** 1.0.0
