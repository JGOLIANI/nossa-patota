import 'package:flutter/material.dart';
import '../store.dart';
import 'common.dart';

bool validEmail(String value) =>
    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim());

class LoginPage extends StatefulWidget {
  const LoginPage(this.store, {super.key});
  final AppStore store;
  @override
  State<LoginPage> createState() => _LoginState();
}

class _LoginState extends State<LoginPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController();
  bool register = false, recover = false, legacy = false, busy = false;
  String? error, message;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      if (recover) {
        await widget.store.backend.resetPassword(email.text);
        if (mounted) {
          setState(
            () => message =
                'Se houver uma conta com esse e-mail, você receberá um link para escolher uma nova senha.',
          );
        }
      } else if (register) {
        final session = await widget.store.backend.signUp({
          'email': email.text,
          'password': password.text,
          'full_name': name.text.trim(),
        });
        await widget.store.refresh();
        if (!session && mounted) {
          setState(() {
            register = false;
            message =
                'Conta criada. Confirme seu e-mail pelo link recebido e depois entre.';
          });
        }
      } else {
        await widget.store.signIn(email.text, password.text);
      }
    } catch (e) {
      if (mounted) setState(() => error = translateError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void mode({bool signup = false, bool recovery = false, bool old = false}) {
    setState(() {
      register = signup;
      recover = recovery;
      legacy = old;
      error = null;
      message = null;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 384),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Icon(
                      Icons.sports_soccer,
                      size: 40,
                      color: Theme.of(context).colorScheme.onPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Nossa Patota',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  recover
                      ? 'Recuperar o acesso'
                      : register
                      ? 'Crie seu acesso de jogador'
                      : 'Entre para ver a partida',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                if (register) field('Nome completo', name),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: TextFormField(
                    controller: email,
                    keyboardType: legacy
                        ? TextInputType.text
                        : TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: legacy ? null : const [AutofillHints.email],
                    decoration: InputDecoration(
                      labelText: legacy ? 'Usuário da conta antiga' : 'E-mail',
                      hintText: legacy ? 'seu.usuario' : 'voce@exemplo.com',
                    ),
                    validator: (v) {
                      if ((v ?? '').trim().isEmpty) {
                        return 'Preencha este campo';
                      }
                      if (!legacy && !validEmail(v!)) {
                        return 'Informe um e-mail válido';
                      }
                      return null;
                    },
                  ),
                ),
                if (!recover)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: TextFormField(
                      controller: password,
                      obscureText: true,
                      autofillHints: [
                        register
                            ? AutofillHints.newPassword
                            : AutofillHints.password,
                      ],
                      decoration: const InputDecoration(labelText: 'Senha'),
                      validator: (v) => (v ?? '').length < 6
                          ? 'Use pelo menos 6 caracteres'
                          : null,
                      onFieldSubmitted: (_) => busy ? null : submit(),
                    ),
                  ),
                if (legacy)
                  const Panel(
                    child: Text(
                      'Use sua conta anterior para manter o histórico. Depois de entrar, vincule um e-mail real pelo perfil.',
                    ),
                  ),
                if (error != null)
                  Panel(
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                if (message != null) Panel(child: Text(message!)),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: busy ? null : submit,
                  child: Text(
                    busy
                        ? 'Aguarde…'
                        : recover
                        ? 'Enviar link de recuperação'
                        : register
                        ? 'Criar meu acesso'
                        : 'Entrar',
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: busy
                      ? null
                      : () => mode(signup: !register && !recover),
                  child: Text(
                    register || recover
                        ? 'Já tenho conta, quero entrar'
                        : 'Primeiro acesso? Criar minha conta',
                  ),
                ),
                if (!register && !recover)
                  TextButton(
                    onPressed: busy ? null : () => mode(recovery: true),
                    child: const Text('Esqueci minha senha'),
                  ),
                if (!register && !recover)
                  TextButton(
                    onPressed: busy ? null : () => mode(old: !legacy),
                    child: Text(
                      legacy
                          ? 'Entrar com e-mail'
                          : 'Conta antiga? Entrar com usuário',
                    ),
                  ),
                if (widget.store.backend.demo)
                  const Panel(
                    child: Text(
                      'Modo demonstração. Use admin@exemplo.com ou igor@exemplo.com e uma senha de 6 caracteres. Não envia e-mails e os dados ficam neste aparelho.',
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class AccountEmailPage extends StatefulWidget {
  const AccountEmailPage(this.store, {super.key});
  final AppStore store;
  @override
  State<AccountEmailPage> createState() => _AccountEmailState();
}

class _AccountEmailState extends State<AccountEmailPage> {
  final email = TextEditingController();
  bool busy = false;
  String? message;
  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'E-mail da conta',
    builder: (context) => ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'E-mail atual: ${widget.store.backend.accountEmail ?? 'não informado'}',
        ),
        const Panel(
          child: Text(
            'Vincule um e-mail real para recuperar a senha. A alteração mantém a mesma conta e o histórico. Confirme os links enviados pelo Supabase; a troca só se conclui após a verificação.',
          ),
        ),
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Novo e-mail'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy
              ? null
              : () async {
                  if (!validEmail(email.text)) {
                    setState(() => message = 'Informe um e-mail válido.');
                    return;
                  }
                  setState(() => busy = true);
                  final ok = await perform(
                    context,
                    () => widget.store.backend.updateEmail(email.text),
                  );
                  if (mounted) {
                    setState(() {
                      busy = false;
                      if (ok) {
                        message = widget.store.backend.demo
                            ? 'E-mail atualizado na demonstração.'
                            : 'Confira os e-mails de confirmação antes de usar o novo endereço.';
                      }
                    });
                  }
                },
          child: const Text('Vincular e-mail'),
        ),
        if (message != null) Panel(child: Text(message!)),
      ],
    ),
  );
}

class PasswordPage extends StatefulWidget {
  const PasswordPage(this.store, {super.key, this.requiredChange = false});
  final AppStore store;
  final bool requiredChange;
  @override
  State<PasswordPage> createState() => _PasswordState();
}

class _PasswordState extends State<PasswordPage> {
  final password = TextEditingController(), repeated = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    password.dispose();
    repeated.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !widget.requiredChange,
    child: Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.requiredChange,
        title: const Text('Trocar senha'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(24),
            children: [
              if (widget.requiredChange)
                const Text(
                  'Você entrou com uma senha provisória. Escolha uma nova senha para continuar.',
                ),
              field('Nova senha', password, password: true),
              field('Repita a senha', repeated, password: true),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (password.text != repeated.text) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('As senhas não conferem.'),
                            ),
                          );
                          return;
                        }
                        setState(() => busy = true);
                        final ok = await perform(
                          context,
                          () => widget.store.changePassword(password.text),
                        );
                        if (mounted) {
                          setState(() => busy = false);
                          if (ok && !widget.requiredChange && context.mounted) {
                            Navigator.pop(context);
                          }
                        }
                      },
                child: const Text('Salvar senha'),
              ),
              if (widget.requiredChange)
                TextButton(
                  onPressed: busy
                      ? null
                      : () => perform(context, widget.store.signOut),
                  child: const Text('Sair'),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
