import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function Destaque({ children }: { children: React.ReactNode }) {
  return <View style={styles.destaqueBox}><Text style={styles.destaqueTxt}>{children}</Text></View>;
}

function DefItem({ termo, def }: { termo: string; def: string }) {
  return (
    <View style={styles.defRow}>
      <Text style={styles.defTermo}>{termo}: </Text>
      <Text style={styles.defTexto}>{def}</Text>
    </View>
  );
}

export default function Termos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Termos de Uso</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.capa}>
        <Text style={styles.capaApp}>eluus</Text>
        <Text style={styles.capaVersao}>Versão 1.0 – 02 de maio de 2026</Text>
      </View>

      {/* ── 1 ── */}
      <Secao titulo="1. SOBRE ESTES TERMOS">
        <P>1.1. Estes Termos de Uso ("Termos") regulam o acesso e a utilização do aplicativo eluus ("Aplicativo"), de propriedade da empresa eluus Tecnologia, inscrita no CNPJ sob o nº 29.456.406/0001-65, com sede na Rua Antônio Roque, S/N – Várzea Grande – MT.</P>
        <P>1.2. Ao baixar, acessar ou usar o Aplicativo, o usuário (passageiro ou motorista) declara ter lido, compreendido e aceitado integralmente estes Termos, bem como a Política de Privacidade.</P>
        <P>1.3. Se o usuário não concordar com qualquer disposição, deverá imediatamente interromper o uso do Aplicativo.</P>
      </Secao>

      {/* ── 2 ── */}
      <Secao titulo="2. DEFINIÇÕES">
        <DefItem termo="Plataforma eluus" def="Aplicativo mobile que conecta motoristas e passageiros que já possuem relação de confiança prévia." />
        <DefItem termo="Passageiro" def="Pessoa física que solicita uma corrida por meio da Plataforma." />
        <DefItem termo="Motorista" def="Pessoa física que oferece serviço de transporte particular mediante remuneração direta do passageiro." />
        <DefItem termo="Corrida" def="Serviço de transporte solicitado pelo passageiro e aceito pelo motorista." />
        <DefItem termo="Código de convite" def="Chave única fornecida pelo eluus para permitir o cadastro de novos usuários." />
        <DefItem termo="Relação de confiança prévia" def="Conhecimento pessoal entre motorista e passageiro anterior ao uso do Aplicativo." />
      </Secao>

      {/* ── 3 ── */}
      <Secao titulo="3. NATUREZA DA PLATAFORMA">
        <P>3.1. O eluus é uma empresa de tecnologia, não uma transportadora, não presta serviços de transporte nem atua como agência de viagens.</P>
        <P>3.2. A Plataforma se limita a intermediar a conexão entre motoristas e passageiros que já se conhecem. A relação contratual de transporte é celebrada diretamente entre motorista e passageiro.</P>
        <P>3.3. O eluus não possui vínculo empregatício, societário ou de representação com qualquer motorista, que atua como prestador de serviços autônomo.</P>
        <P>3.4. O eluus não participa da negociação, execução ou pagamento das corridas. O valor exibido no aplicativo é uma sugestão calculada com base na distância, mas o acordo financeiro final é de responsabilidade exclusiva das partes.</P>
      </Secao>

      {/* ── 4 ── */}
      <Secao titulo="4. ACESSO – SISTEMA DE CONVITE">
        <P>4.1. O uso do eluus é restrito a pessoas que recebam um código de convite válido e que efetivamente já se conheçam pessoalmente.</P>
        <P>4.2. Cada código de convite é pessoal e intransferível. O eluus pode limitar a quantidade de convites por usuário.</P>
        <P>4.3. Ao se cadastrar, o usuário declara, sob as penas da lei, que já conhece pessoalmente a pessoa que lhe forneceu o código.</P>
      </Secao>

      {/* ── 5 ── */}
      <Secao titulo="5. PROIBIÇÃO DE USO ENTRE DESCONHECIDOS">
        <Destaque>Cláusula central do aplicativo. Leia com atenção.</Destaque>
        <P>5.1. É expressamente proibido utilizar o eluus para conectar um passageiro a um motorista que não se conheçam previamente.</P>
        <P>5.2. O simples compartilhamento de um código de convite não configura conhecimento prévio. É necessário que haja relação pessoal anterior (familiar, amigo, vizinho, colega de trabalho, motorista particular de confiança).</P>
        <P>5.3. Consequências da violação — caso se comprove que uma corrida foi realizada entre pessoas que não se conheciam antes do primeiro contato pelo aplicativo:</P>
        <Item>As contas do passageiro e do motorista serão bloqueadas permanentemente;</Item>
        <Item>Ambos perderão o direito a qualquer tipo de reembolso ou crédito;</Item>
        <Item>O infrator poderá ser responsabilizado civil e criminalmente por eventuais danos.</Item>
        <P>5.4. O eluus não possui meios de verificar se duas pessoas se conhecem na vida real, confiando nas declarações prestadas no cadastro e a cada solicitação de corrida.</P>
      </Secao>

      {/* ── 6 ── */}
      <Secao titulo="6. CADASTRO E VERIFICAÇÃO">
        <Text style={styles.subTitulo}>6.1. Para o motorista (obrigatório)</Text>
        <P>Ao se cadastrar, o motorista deverá fornecer:</P>
        <Item>Nome completo</Item>
        <Item>CPF</Item>
        <Item>CNH (frente e verso, com categoria compatível com transporte de passageiros e anotação EAR – Exerce Atividade Remunerada)</Item>
        <Item>CRLV do veículo</Item>
        <Item>Foto de perfil nítida</Item>
        <Item>Selfie segurando um documento de identificação</Item>
        <Item>Comprovante de residência atualizado</Item>
        <P>O eluus poderá, a seu critério, validar esses documentos por meio de sistemas de terceiros ou manualmente.</P>
        <Text style={styles.subTitulo}>6.2. Para o passageiro</Text>
        <Item>Nome completo</Item>
        <Item>CPF</Item>
        <Item>Telefone celular válido</Item>
        <Item>Foto de perfil (opcional, mas recomendada)</Item>
        <P>6.3. O fornecimento de informações falsas ou documentos adulterados acarretará o bloqueio imediato e permanente da conta, além de comunicação às autoridades competentes.</P>
      </Secao>

      {/* ── 7 ── */}
      <Secao titulo="7. OBRIGAÇÕES DO MOTORISTA">
        <P>7.1. O motorista declara e garante que:</P>
        <Item>Possui Carteira Nacional de Habilitação (CNH) válida, compatível com a categoria do veículo utilizado e com a anotação EAR (Exerce Atividade Remunerada), exigida por lei para transporte remunerado de passageiros.</Item>
        <Item>O veículo está em boas condições de funcionamento, com manutenção em dia, pneus, freios, faróis e cintos de segurança operacionais.</Item>
        <Item>Possui toda a documentação do veículo em dia (CRLV, licenciamento).</Item>
        <Item>Não possui seguro para transporte remunerado de passageiros ou, se possuir, declara o número da apólice neste ato.</Item>
        <Item>Na ausência de seguro específico, o motorista assume total e exclusiva responsabilidade civil e criminal por quaisquer danos materiais, corporais, morais ou fatais sofridos pelo passageiro durante a corrida, incluindo despesas médicas, indenizações por invalidez ou morte.</Item>
        <P>7.2. O motorista é o único responsável pela segurança do trajeto, pelo cumprimento das leis de trânsito, pelo comportamento dentro do veículo e pela integridade física do passageiro.</P>
        <P>7.3. O eluus não fornece qualquer tipo de seguro aos usuários. Recomenda-se fortemente que o motorista contrate um Seguro APP (Acidentes Pessoais de Passageiros) junto a uma seguradora de sua escolha.</P>
        <P>7.4. Ao aceitar uma corrida, o motorista autoriza o compartilhamento de sua localização em tempo real com o passageiro durante todo o percurso (do ponto de partida ao destino final).</P>
      </Secao>

      {/* ── 8 ── */}
      <Secao titulo="8. OBRIGAÇÕES DO PASSAGEIRO">
        <P>8.1. O passageiro deve:</P>
        <Item>Fornecer informações verdadeiras sobre o destino.</Item>
        <Item>Aguardar o motorista no local indicado.</Item>
        <Item>Não fazer exigências que coloquem em risco a segurança ou contrariem as leis de trânsito.</Item>
        <Item>Tratar o motorista com respeito.</Item>
        <P>8.2. O passageiro reconhece que o eluus não é responsável pela conduta do motorista, pela condição do veículo, por atrasos ou cancelamentos.</P>
        <P>8.3. Menores de 18 anos só podem utilizar o eluus se estiverem acompanhados de um responsável legal que também seja usuário cadastrado. Menores de 16 anos precisam de autorização expressa dos pais ou tutores, que deverá ser enviada ao e-mail de suporte antes da primeira corrida.</P>
      </Secao>

      {/* ── 9 ── */}
      <Secao titulo="9. PAGAMENTO DAS CORRIDAS">
        <P>9.1. Atualmente, o pagamento é realizado diretamente entre passageiro e motorista, preferencialmente por PIX manual, podendo ser combinado outro meio (dinheiro, transferência bancária).</P>
        <P>9.2. O valor sugerido pelo aplicativo é calculado com base na distância real (motorista → passageiro + passageiro → destino). Esse valor é meramente informativo; as partes podem acordar valor diferente.</P>
        <P>9.3. Em momento futuro, o eluus poderá:</P>
        <Item>Cobrar uma taxa fixa de R$ 1,00 por corrida (repassada ao motorista ou cobrada do passageiro);</Item>
        <Item>Oferecer assinatura mensal para motoristas (valor a definir);</Item>
        <Item>Implementar pagamento integrado via carteira digital.</Item>
        <P>Qualquer alteração nesse sentido será comunicada com antecedência mínima de 30 dias.</P>
        <P>9.4. É proibido ao motorista cobrar valor adicional além do combinado antes do início da corrida. Práticas de "preço abusivo" ou "cobrança extra por fora" sujeitam o motorista a bloqueio imediato.</P>
      </Secao>

      {/* ── 10 ── */}
      <Secao titulo="10. CANCELAMENTO DE CORRIDA">
        <P>10.1. Tanto o passageiro quanto o motorista podem cancelar uma corrida a qualquer momento antes do início da viagem.</P>
        <P>10.2. Não há multa ou penalidade financeira para cancelamentos nesta fase.</P>
        <P>10.3. Cancelamentos excessivos (mais de 30% das corridas solicitadas ou aceitas) podem resultar em suspensão temporária da conta, a critério do eluus.</P>
      </Secao>

      {/* ── 11 ── */}
      <Secao titulo="11. AVALIAÇÕES E REPUTAÇÃO">
        <P>11.1. Após cada corrida, passageiro e motorista poderão avaliar um ao outro com notas de 1 a 5 estrelas e comentários opcionais.</P>
        <P>11.2. As avaliações são públicas dentro da plataforma e servem para construir a reputação de cada usuário.</P>
        <P>11.3. Motoristas com média inferior a 3 estrelas ou que receberem mais de 10% de avaliações 1 estrela nos últimos 30 dias poderão ter sua conta suspensa ou bloqueada.</P>
        <P>11.4. O eluus não modifica, edita ou remove avaliações, exceto nos casos de:</P>
        <Item>Conteúdo claramente falso, difamatório ou ofensivo;</Item>
        <Item>Avaliação feita por engano após corrida não realizada.</Item>
      </Secao>

      {/* ── 12 ── */}
      <Secao titulo="12. CHAT E COMPORTAMENTO DURANTE A CORRIDA">
        <P>12.1. O chat dentro do aplicativo é destinado exclusivamente a assuntos relacionados à corrida atual (ex.: localização, tempo de espera, confirmação de destino).</P>
        <P>12.2. São proibidas:</P>
        <Item>Mensagens com conteúdo sexual, ofensivo, discriminatório ou ameaçador;</Item>
        <Item>Compartilhamento de dados pessoais (telefone, e-mail, endereço) com intuito de realizar corridas fora da plataforma;</Item>
        <Item>Spam ou propaganda.</Item>
        <P>12.3. O descumprimento enseja bloqueio definitivo.</P>
      </Secao>

      {/* ── 13 ── */}
      <Secao titulo="13. SUSPENSÃO, BLOQUEIO E RESCISÃO">
        <P>13.1. O eluus pode suspender temporariamente, bloquear ou cancelar permanentemente a conta de qualquer usuário nas seguintes hipóteses:</P>
        <Item>Violação da proibição de uso entre desconhecidos (item 5);</Item>
        <Item>Fornecimento de informações falsas ou documentos inválidos;</Item>
        <Item>Comportamento inadequado (agressividade, assédio, discriminação);</Item>
        <Item>Cobrança extra não autorizada;</Item>
        <Item>Avaliação constantemente baixa (item 11.3);</Item>
        <Item>Denúncia fundamentada de crime ou ato ilícito durante a corrida.</Item>
        <P>13.2. Antes do bloqueio permanente, o usuário será notificado por e-mail e terá 48 horas para apresentar sua defesa.</P>
        <P>13.3. O eluus não é obrigado a justificar a suspensão temporária, mas agirá de boa-fé e com base em evidências.</P>
      </Secao>

      {/* ── 14 ── */}
      <Secao titulo="14. LIMITAÇÃO DE RESPONSABILIDADE">
        <P>14.1. O eluus não se responsabiliza, nos limites máximos permitidos pela lei brasileira, por:</P>
        <Item>Danos materiais, corporais, morais ou fatais decorrentes da prestação do serviço de transporte pelo motorista, incluindo acidentes de trânsito;</Item>
        <Item>Atrasos, cancelamentos, desvios de rota;</Item>
        <Item>Objetos esquecidos, roubados ou danificados dentro do veículo;</Item>
        <Item>Conduta ilegal ou abusiva do motorista ou passageiro.</Item>
        <P>14.2. O passageiro e o motorista reconhecem que o serviço de transporte é prestado diretamente entre eles, sendo o eluus mero intermediário tecnológico.</P>
        <P>14.3. Ressalva legal: a presente cláusula não exclui a responsabilidade do eluus nos casos de dolo, culpa grave ou violação da legislação consumerista (Código de Defesa do Consumidor – Lei 8.078/90), notadamente em situações de defeito na prestação do serviço da plataforma. Contudo, acidentes de trânsito não configuram, por si só, defeito na plataforma.</P>
      </Secao>

      {/* ── 15 ── */}
      <Secao titulo="15. DISPOSIÇÕES GERAIS">
        <P>15.1. Alterações nos Termos: O eluus poderá modificar estes Termos a qualquer momento. As alterações serão comunicadas por e-mail ou por meio do próprio aplicativo. O uso continuado após a comunicação implica aceitação.</P>
        <P>15.2. Cessão: O usuário não pode ceder ou transferir sua conta a terceiros.</P>
        <P>15.3. Idioma: Estes Termos foram redigidos em português. Qualquer versão em outro idioma é meramente ilustrativa.</P>
        <P>15.4. Foro: Fica eleito o foro da comarca de Cuiabá – Mato Grosso para dirimir quaisquer controvérsias oriundas destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</P>
      </Secao>

      {/* ── 16 ── */}
      <Secao titulo="16. CONTATO">
        <P>Para questões relacionadas a estes Termos, à Política de Privacidade, ou para exercer seus direitos como titular de dados pessoais (LGPD), entre em contato:</P>
        <View style={styles.contatoCard}>
          <Text style={styles.contatoLabel}>E-mail</Text>
          <Text style={styles.contatoValor}>contato@eluus.app</Text>
          <Text style={styles.contatoLabel}>Telefone / WhatsApp</Text>
          <Text style={styles.contatoValor}>(65) 98432-2755</Text>
        </View>
      </Secao>

      {/* Declaração de aceite */}
      <View style={styles.aceiteCard}>
        <Text style={styles.aceiteTitulo}>Declaração de aceite</Text>
        <Text style={styles.aceiteTexto}>
          Ao utilizar o aplicativo eluus, declaro que li, compreendi e aceito integralmente estes Termos de Uso.
        </Text>
        <Text style={styles.aceiteData}>
          Data do aceite: registrada automaticamente no primeiro acesso ao aplicativo.
        </Text>
      </View>

      <View style={styles.linkExternoWrap}>
        <TouchableOpacity onPress={() => router.push('/privacidade')} style={styles.linkExternoBtn}>
          <Text style={styles.linkExternoTxt}>Ver Política de Privacidade →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/consentimento-localizacao')} style={styles.linkExternoBtn}>
          <Text style={styles.linkExternoTxt}>Ver Consentimento de Localização →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  voltarBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  voltarTxt: { color: '#94a3b8', fontSize: 13 },
  titulo: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  capa: { alignItems: 'center', marginBottom: 32, paddingVertical: 20, backgroundColor: '#1a1f2e', borderRadius: 16, borderWidth: 1, borderColor: '#2a3044' },
  capaApp: { fontSize: 28, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 2, marginBottom: 6 },
  capaVersao: { fontSize: 13, color: '#64748b' },
  secao: { marginBottom: 28 },
  secaoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a1f2e' },
  subTitulo: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 10, marginBottom: 6 },
  paragrafo: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 10 },
  item: { fontSize: 13, color: '#94a3b8', lineHeight: 21, marginBottom: 6, paddingLeft: 8 },
  destaqueBox: { backgroundColor: '#1a140a', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' },
  destaqueTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '600', lineHeight: 20 },
  defRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, paddingLeft: 4 },
  defTermo: { fontSize: 13, color: '#fff', fontWeight: '700' },
  defTexto: { fontSize: 13, color: '#94a3b8', lineHeight: 20, flex: 1 },
  contatoCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, gap: 4, borderWidth: 1, borderColor: '#2a3044', marginTop: 8 },
  contatoLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  contatoValor: { fontSize: 15, color: '#4a9eff', fontWeight: '600' },
  aceiteCard: { backgroundColor: '#0f2a1a', borderRadius: 16, padding: 20, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#22c55e', gap: 8 },
  aceiteTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 14 },
  aceiteTexto: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  aceiteData: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
  linkExternoWrap: { gap: 10, marginTop: 16 },
  linkExternoBtn: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  linkExternoTxt: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
});
