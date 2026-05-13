import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragrafo}>{children}</Text>;
}

function Item({ children }: { children: React.ReactNode }) {
  return <Text style={styles.item}>{'• '}{children}</Text>;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.avisoBox}>
      <Text style={styles.avisoTxt}>{children}</Text>
    </View>
  );
}

function TabelaUso({ rows }: { rows: [string, string][] }) {
  return (
    <View style={styles.tabela}>
      <View style={[styles.tabelaRow, styles.tabelaHeader]}>
        <Text style={[styles.tabelaCell, styles.tabelaHeaderTxt, { flex: 1 }]}>Uso</Text>
        <Text style={[styles.tabelaCell, styles.tabelaHeaderTxt, { flex: 1.4 }]}>Finalidade</Text>
      </View>
      {rows.map(([uso, finalidade], i) => (
        <View key={i} style={[styles.tabelaRow, i % 2 === 1 && styles.tabelaRowAlt]}>
          <Text style={[styles.tabelaCell, { flex: 1 }]}>{uso}</Text>
          <Text style={[styles.tabelaCell, { flex: 1.4 }]}>{finalidade}</Text>
        </View>
      ))}
    </View>
  );
}

function PassoInstrucao({ plataforma, passos }: { plataforma: string; passos: string[] }) {
  return (
    <View style={styles.passoCard}>
      <Text style={styles.passoPlataforma}>{plataforma}</Text>
      {passos.map((p, i) => (
        <Text key={i} style={styles.passoTexto}>{i + 1}. {p}</Text>
      ))}
    </View>
  );
}

function BaseLegal({ base, desc }: { base: string; desc: string }) {
  return (
    <View style={styles.baseRow}>
      <Text style={styles.baseTitulo}>{base}</Text>
      <Text style={styles.baseDesc}>{desc}</Text>
    </View>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return <Text style={styles.checkItem}>{'✔ '}{children}</Text>;
}

export default function ConsentimentoLocalizacao() {
  const router = useRouter();
  const dataConsentimento = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Consentimento de Localização</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.capa}>
        <Text style={styles.capaApp}>eluus</Text>
        <Text style={styles.capaVersao}>eluus Tecnologia – Versão 1.0</Text>
      </View>

      {/* ── 1 ── */}
      <Secao titulo='1. O que significa "localização em segundo plano"?'>
        <P>
          Quando você não está usando o aplicativo eluus ativamente (por exemplo, o app está
          minimizado, seu celular está bloqueado ou você está usando outro aplicativo), o eluus
          ainda pode acessar a localização do seu dispositivo se você for um motorista e estiver
          com o status "online".
        </P>
      </Secao>

      {/* ── 2 ── */}
      <Secao titulo="2. Por que o eluus precisa dessa permissão?">
        <View style={styles.badgeMotorista}>
          <Text style={styles.badgeTxt}>Apenas para motoristas</Text>
        </View>
        <P>O eluus solicita localização em segundo plano para:</P>
        <Item>Manter seu status online/offline atualizado em tempo real, mesmo com o app fechado.</Item>
        <Item>Permitir que passageiros que você já adicionou vejam se você está disponível para corridas.</Item>
        <Item>Calcular a distância até o passageiro e o destino antes mesmo de você abrir o app.</Item>
        <Item>Receber notificações de nova solicitação de corrida enquanto o app está em segundo plano.</Item>
        <View style={styles.infoPassageiro}>
          <Text style={styles.infoPassageiroTxt}>
            Para passageiros: o eluus não coleta localização em segundo plano. A localização do
            passageiro só é coletada quando ele abre o app e solicita uma corrida.
          </Text>
        </View>
      </Secao>

      {/* ── 3 ── */}
      <Secao titulo="3. Quando a localização em segundo plano é coletada?">
        <Item>Somente quando o motorista está com o status "online" dentro do aplicativo.</Item>
        <Item>
          Se o motorista estiver "offline", o eluus para completamente de coletar localização
          em segundo plano.
        </Item>
        <Item>
          O motorista pode mudar o status a qualquer momento (botão "Ligar/Desligar
          disponibilidade").
        </Item>
      </Secao>

      {/* ── 4 ── */}
      <Secao titulo="4. Como a localização é usada?">
        <TabelaUso rows={[
          ['Exibir sua posição no mapa do passageiro', 'Para que o passageiro saiba onde você está e quando chegará'],
          ['Calcular distância até o passageiro', 'Para sugerir o valor justo da corrida'],
          ['Calcular rota até o destino', 'Para navegação integrada'],
          ['Aviso automático de chegada (200 m)', 'Para notificar o passageiro que você está próximo'],
        ]} />
        <P style={{ marginTop: 14 }}>
          <Text style={styles.bold}>Importante:</Text>
          {'  '}Sua localização não é compartilhada com:
        </P>
        <Item>Terceiros para publicidade</Item>
        <Item>Passageiros que você não adicionou como contato</Item>
        <Item>Qualquer pessoa fora da corrida ativa</Item>
      </Secao>

      {/* ── 5 ── */}
      <Secao titulo="5. Quanto tempo a localização é armazenada?">
        <Item>
          <Text style={styles.bold}>Durante a corrida:</Text> armazenamos a rota completa por 12
          meses (para resolver eventuais disputas).
        </Item>
        <Item>
          <Text style={styles.bold}>Quando você está online mas sem corrida ativa:</Text>{' '}
          armazenamos apenas a última localização conhecida (a cada 30 segundos), sem histórico
          de trajetos.
        </Item>
        <Item>
          Após 12 meses, os dados de localização são anonimizados (perdem vínculo com seu
          CPF/nome).
        </Item>
      </Secao>

      {/* ── 6 ── */}
      <Secao titulo="6. Como desativar a localização em segundo plano?">
        <P>Você pode revogar essa permissão a qualquer momento de duas formas:</P>
        <PassoInstrucao
          plataforma="No aplicativo"
          passos={[
            'Vá em Configurações',
            'Privacidade',
            'Desativar localização em segundo plano',
          ]}
        />
        <PassoInstrucao
          plataforma="Android"
          passos={[
            'Configurações > Apps > eluus',
            'Permissões > Localização',
            'Escolher "Permitir apenas enquanto o app está em uso"',
          ]}
        />
        <PassoInstrucao
          plataforma="iOS (iPhone)"
          passos={[
            'Configurações > Privacidade',
            'Serviços de Localização > eluus',
            'Escolher "Enquanto usa o app"',
          ]}
        />
        <Aviso>
          Se você desativar a localização em segundo plano, seu status online/offline pode ficar
          desatualizado, e passageiros podem não conseguir solicitar corridas com você de forma
          confiável.
        </Aviso>
      </Secao>

      {/* ── 7 ── */}
      <Secao titulo="7. Seu consentimento é livre e pode ser revogado">
        <Item>Você não é obrigado a aceitar esta permissão para usar o eluus como passageiro.</Item>
        <Item>
          Como motorista, se você não aceitar a localização em segundo plano, ainda poderá usar
          o app, mas não poderá ficar online com o app fechado – você precisará manter o eluus
          aberto em primeiro plano para receber solicitações.
        </Item>
      </Secao>

      {/* ── 8 ── */}
      <Secao titulo="8. Base legal (LGPD)">
        <P>O tratamento da localização em segundo plano se baseia em:</P>
        <View style={styles.baseContainer}>
          <BaseLegal
            base="Execução do contrato (Termos de Uso)"
            desc="Para permitir que o motorista preste o serviço de transporte."
          />
          <BaseLegal
            base="Interesse legítimo"
            desc="Para garantir a segurança e a funcionalidade da plataforma."
          />
          <BaseLegal
            base="Consentimento"
            desc="Na forma desta tela, conforme exige a LGPD para dados sensíveis (localização em tempo real)."
          />
        </View>
      </Secao>

      {/* ── 9 ── */}
      <Secao titulo="9. Declaração do usuário">
        <View style={styles.declaracaoCard}>
          <Text style={styles.declaracaoTitulo}>Declaração de consentimento</Text>
          <CheckItem>Li e compreendi este Termo de Consentimento.</CheckItem>
          <CheckItem>
            Sei que o eluus coletará minha localização mesmo quando o app estiver em segundo
            plano apenas quando eu estiver como motorista e com status "online".
          </CheckItem>
          <CheckItem>
            Entendo que posso desativar essa permissão a qualquer momento pelo app ou pelas
            configurações do celular.
          </CheckItem>
          <CheckItem>
            Autorizo o eluus a tratar minha localização em segundo plano nos termos descritos
            acima.
          </CheckItem>
          <View style={styles.declaracaoRodape}>
            <Text style={styles.declaracaoDataLabel}>Data do consentimento</Text>
            <Text style={styles.declaracaoData}>{dataConsentimento}</Text>
            <Text style={styles.declaracaoVersao}>Versão do termo: 1.0 (válida a partir de 02 de maio de 2026)</Text>
          </View>
        </View>
      </Secao>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  voltarBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  voltarTxt: { color: '#94a3b8', fontSize: 13 },
  titulo: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center', flex: 1 },
  capa: { alignItems: 'center', marginBottom: 32, paddingVertical: 20, backgroundColor: '#1a1f2e', borderRadius: 16, borderWidth: 1, borderColor: '#2a3044' },
  capaApp: { fontSize: 28, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 2, marginBottom: 6 },
  capaVersao: { fontSize: 13, color: '#64748b' },
  secao: { marginBottom: 28 },
  secaoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a1f2e' },
  paragrafo: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 10 },
  item: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 8, paddingLeft: 8 },
  bold: { fontWeight: '700', color: '#cbd5e1' },
  avisoBox: { backgroundColor: '#1a140a', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#f59e0b' },
  avisoTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '600', lineHeight: 20 },
  badgeMotorista: { backgroundColor: '#0f1f3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#4a9eff' },
  badgeTxt: { color: '#4a9eff', fontSize: 12, fontWeight: '700' },
  infoPassageiro: { backgroundColor: '#0f2a1a', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#22c55e' },
  infoPassageiroTxt: { color: '#22c55e', fontSize: 13, lineHeight: 20 },
  tabela: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2a3044', marginTop: 8 },
  tabelaHeader: { backgroundColor: '#1e2535' },
  tabelaHeaderTxt: { color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  tabelaRow: { flexDirection: 'row', backgroundColor: '#131720' },
  tabelaRowAlt: { backgroundColor: '#0f1318' },
  tabelaCell: { fontSize: 12, color: '#94a3b8', padding: 10, lineHeight: 18 },
  passoCard: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2a3044' },
  passoPlataforma: { fontSize: 13, fontWeight: '700', color: '#4a9eff', marginBottom: 8 },
  passoTexto: { fontSize: 13, color: '#94a3b8', lineHeight: 20, marginBottom: 4 },
  baseContainer: { gap: 8, marginTop: 4 },
  baseRow: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#4a9eff' },
  baseTitulo: { fontSize: 13, fontWeight: '700', color: '#cbd5e1', marginBottom: 4 },
  baseDesc: { fontSize: 13, color: '#94a3b8', lineHeight: 20 },
  declaracaoCard: { backgroundColor: '#0f1f3a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#4a9eff', gap: 10 },
  declaracaoTitulo: { color: '#4a9eff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  checkItem: { fontSize: 13, color: '#94a3b8', lineHeight: 21, paddingLeft: 4 },
  declaracaoRodape: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e2a4a', gap: 4 },
  declaracaoDataLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  declaracaoData: { fontSize: 15, color: '#4a9eff', fontWeight: '600' },
  declaracaoVersao: { fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 4 },
});
