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
  bool showPassword = false;
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
    FocusManager.instance.primaryFocus?.unfocus();
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
    FocusManager.instance.primaryFocus?.unfocus();
    form.currentState?.reset();
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
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(PatotaSpace.xl),
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(PatotaRadius.modal),
                        border: Border.all(
                          color: Theme.of(
                            context,
                          ).colorScheme.primary.withValues(alpha: .2),
                        ),
                      ),
                      child: Icon(
                        Icons.sports_soccer_rounded,
                        size: 48,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: PatotaSpace.lg),
                  Text(
                    'Nossa Patota',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: PatotaSpace.sm),
                  Text(
                    recover
                        ? 'Vamos recuperar seu acesso'
                        : register
                        ? 'Seu lugar no time começa aqui'
                        : 'Entre para ver a partida',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: PatotaSpace.xl),
                  if (register)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: PatotaSpace.sm,
                      ),
                      child: TextFormField(
                        controller: name,
                        textCapitalization: TextCapitalization.words,
                        autofillHints: const [AutofillHints.name],
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Nome completo',
                          prefixIcon: Icon(Icons.person_rounded),
                        ),
                        validator: (v) => (v ?? '').trim().isEmpty
                            ? 'Conte como a turma pode chamar você.'
                            : null,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: PatotaSpace.sm,
                    ),
                    child: TextFormField(
                      controller: email,
                      keyboardType: legacy
                          ? TextInputType.text
                          : TextInputType.emailAddress,
                      autocorrect: false,
                      autofillHints: legacy
                          ? null
                          : const [AutofillHints.email],
                      textInputAction: recover
                          ? TextInputAction.done
                          : TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: legacy
                            ? 'Usuário da conta antiga'
                            : 'E-mail',
                        hintText: legacy ? 'seu.usuario' : 'voce@exemplo.com',
                        prefixIcon: Icon(
                          legacy ? Icons.person_rounded : Icons.mail_rounded,
                        ),
                      ),
                      validator: (v) {
                        if ((v ?? '').trim().isEmpty) {
                          return legacy
                              ? 'Informe seu usuário para entrar.'
                              : 'Informe seu e-mail para continuar.';
                        }
                        if (!legacy && !validEmail(v!)) {
                          return 'Confira o e-mail. Exemplo: voce@exemplo.com';
                        }
                        return null;
                      },
                    ),
                  ),
                  if (!recover)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: PatotaSpace.sm,
                      ),
                      child: TextFormField(
                        controller: password,
                        obscureText: !showPassword,
                        textInputAction: TextInputAction.done,
                        autofillHints: [
                          register
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        decoration: InputDecoration(
                          labelText: 'Senha',
                          prefixIcon: const Icon(Icons.lock_rounded),
                          suffixIcon: IconButton(
                            tooltip: showPassword
                                ? 'Ocultar senha'
                                : 'Mostrar senha',
                            onPressed: () =>
                                setState(() => showPassword = !showPassword),
                            icon: Icon(
                              showPassword
                                  ? Icons.visibility_off_rounded
                                  : Icons.visibility_rounded,
                            ),
                          ),
                        ),
                        validator: (v) => (v ?? '').length < 6
                            ? 'Use pelo menos 6 caracteres'
                            : null,
                        onFieldSubmitted: (_) => busy ? null : submit(),
                      ),
                    ),
                  if (legacy)
                    const _AuthNotice(
                      icon: Icons.history_rounded,
                      message:
                          'Seu histórico vem com você. Entre com a conta anterior e vincule um e-mail real pelo perfil.',
                    ),
                  if (error != null)
                    _AuthNotice(
                      icon: Icons.error_outline_rounded,
                      message: error!,
                      isError: true,
                    ),
                  if (message != null)
                    _AuthNotice(
                      icon: Icons.check_circle_rounded,
                      message: message!,
                    ),
                  const SizedBox(height: PatotaSpace.lg),
                  PrimaryButton(
                    onPressed: busy ? null : submit,
                    loading: busy,
                    error: error != null,
                    icon: recover
                        ? Icons.mail_rounded
                        : Icons.arrow_forward_rounded,
                    label: recover
                        ? 'Enviar link de recuperação'
                        : register
                        ? 'Criar meu acesso'
                        : 'Entrar',
                  ),
                  const SizedBox(height: PatotaSpace.lg),
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
                    const _AuthNotice(
                      icon: Icons.sports_soccer_rounded,
                      message:
                          'Experimente a patota\nUse admin@exemplo.com ou igor@exemplo.com e uma senha de 6 caracteres. A demonstração salva os dados neste aparelho e não envia e-mails.',
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _AuthNotice extends StatelessWidget {
  const _AuthNotice({
    required this.icon,
    required this.message,
    this.isError = false,
  });
  final IconData icon;
  final String message;
  final bool isError;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
        padding: const EdgeInsets.all(PatotaSpace.lg),
        decoration: BoxDecoration(
          color: isError ? scheme.errorContainer : scheme.surfaceContainer,
          borderRadius: BorderRadius.circular(PatotaRadius.lg),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              size: 24,
              color: isError ? scheme.error : scheme.primary,
            ),
            const SizedBox(width: PatotaSpace.md),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isError ? scheme.onErrorContainer : scheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
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
      padding: const EdgeInsets.all(PatotaSpace.lg),
      children: [
        Text(
          'E-mail atual: ${widget.store.backend.accountEmail ?? 'não informado'}',
        ),
        const _AuthNotice(
          icon: Icons.verified_user_rounded,
          message:
              'Um e-mail real ajuda a recuperar sua senha. A troca mantém sua conta e seu histórico. Confirme os links enviados para concluir a alteração.',
        ),
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Novo e-mail',
            prefixIcon: Icon(Icons.mail_rounded),
          ),
        ),
        const SizedBox(height: PatotaSpace.lg),
        PrimaryButton(
          label: 'Vincular e-mail',
          icon: Icons.check_rounded,
          loading: busy,
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
        ),
        if (message != null)
          _AuthNotice(icon: Icons.info_rounded, message: message!),
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
            padding: const EdgeInsets.all(PatotaSpace.xl),
            children: [
              if (widget.requiredChange)
                const Text(
                  'Escolha uma nova senha para continuar com sua patota.',
                ),
              field('Nova senha', password, password: true),
              field('Repita a senha', repeated, password: true),
              PrimaryButton(
                label: 'Salvar senha',
                icon: Icons.check_rounded,
                loading: busy,
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
