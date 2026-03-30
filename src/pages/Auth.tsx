import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';
import { PRODUCT } from '@/config/product';
import { getAppUrl } from '@/lib/app-url';

const passwordSchema = z.string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .regex(/[a-z]/, 'Deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'Deve conter pelo menos um número');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  companyName: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type PasswordSetupFormData = {
  password: string;
  confirmPassword: string;
};

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState<PasswordSetupFormData>({ password: '', confirmPassword: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const authHashParams = useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, '')), []);
  const authFlowType = authHashParams.get('type');
  const isPasswordSetupFlow = authFlowType === 'invite' || authFlowType === 'recovery';

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', companyName: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!isPasswordSetupFlow || !user) return;

    toast({
      title: authFlowType === 'invite' ? 'Convite confirmado' : 'Recuperação de senha',
      description: 'Defina sua senha para continuar.',
    });
  }, [authFlowType, isPasswordSetupFlow, toast, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user && !isPasswordSetupFlow) {
    return <Navigate to="/inbox" replace />;
  }

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      const errorMessage = error.message || '';
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: errorMessage === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : errorMessage.toLowerCase().includes('email not confirmed')
          ? 'O usuário existe, mas o email ainda não foi confirmado.'
          : errorMessage,
      });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const signedUser = sessionData.session?.user;

    if (!signedUser) {
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: 'A sessão não foi iniciada corretamente. Tente novamente.',
      });
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', signedUser.id)
      .eq('is_active', true)
      .limit(1);

    if (membershipError) {
      toast({
        variant: 'destructive',
        title: 'Acesso incompleto',
        description: 'O login foi aceito, mas não foi possível validar o workspace do usuário.',
      });
      return;
    }

    if (!memberships || memberships.length === 0) {
      await supabase.auth.signOut();
      toast({
        variant: 'destructive',
        title: 'Usuário sem workspace',
        description: 'Este usuário ainda não foi vinculado a um workspace ativo. Revise o cadastro na tela Equipe.',
      });
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsSubmitting(true);
    const { error } = await signUp(data.email, data.password, data.name, data.companyName);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: error.message === 'User already registered'
          ? 'Este email já está registrado'
          : error.message,
      });
    } else {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você já pode fazer login.',
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite seu email',
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${getAppUrl()}/auth`,
      });

      if (error) throw error;

      toast({
        title: 'Email enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });

      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error: any) {
      const errorMessage = String(error?.message || '');
      const isRateLimited =
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('security purposes');

      toast({
        variant: 'destructive',
        title: 'Erro',
        description: isRateLimited
          ? 'Muitas tentativas de recuperação em pouco tempo. Aguarde alguns minutos antes de tentar novamente.'
          : errorMessage || 'Não foi possível enviar o email de recuperação.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handlePasswordSetup = async () => {
    if (passwordSetup.password !== passwordSetup.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas não coincidem',
        description: 'Confirme a mesma senha nos dois campos.',
      });
      return;
    }

    const validation = passwordSchema.safeParse(passwordSetup.password);
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Senha inválida',
        description: validation.error.errors[0]?.message ?? 'Revise os requisitos da senha.',
      });
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordSetup.password });
    setIsUpdatingPassword(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao definir senha',
        description: error.message,
      });
      return;
    }

    window.history.replaceState(null, '', '/auth');
    toast({
      title: 'Senha definida com sucesso',
      description: 'Seu acesso foi ativado. Redirecionando para a inbox.',
    });
    window.location.assign('/inbox');
  };

  if (isPasswordSetupFlow && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-24 h-24">
              <img src={logo} alt={PRODUCT.name} className="w-full h-full object-contain" />
            </div>
            <CardTitle>Defina sua senha</CardTitle>
            <CardDescription>
              {authFlowType === 'invite'
                ? 'Seu convite foi validado. Crie uma senha para entrar no workspace.'
                : 'Escolha uma nova senha para recuperar seu acesso.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-password">Nova senha</Label>
              <Input
                id="setup-password"
                type="password"
                placeholder="••••••••"
                value={passwordSetup.password}
                onChange={(event) => setPasswordSetup((current) => ({ ...current, password: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-confirm-password">Confirmar senha</Label>
              <Input
                id="setup-confirm-password"
                type="password"
                placeholder="••••••••"
                value={passwordSetup.confirmPassword}
                onChange={(event) => setPasswordSetup((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Use pelo menos 8 caracteres com letras maiúsculas, minúsculas e números.
            </p>

            <Button className="w-full" onClick={handlePasswordSetup} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? 'Salvando...' : 'Salvar senha e entrar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 w-32 h-32">
            <img src={logo} alt={PRODUCT.name} className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl">{PRODUCT.name}</CardTitle>
          <CardDescription>
            Plataforma de atendimento WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...loginForm.register('email')}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••"
                    {...loginForm.register('password')}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-foreground text-center w-full mt-2"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <Input
                    id="signup-name"
                    placeholder="Seu nome"
                    {...signupForm.register('name')}
                  />
                  {signupForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...signupForm.register('email')}
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-company">Nome da Empresa</Label>
                  <Input
                    id="signup-company"
                    placeholder="Nome da sua empresa"
                    {...signupForm.register('companyName')}
                  />
                  {signupForm.formState.errors.companyName && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.companyName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••"
                    {...signupForm.register('password')}
                  />
                  {signupForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••"
                    {...signupForm.register('confirmPassword')}
                  />
                  {signupForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {signupForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Criando conta...' : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber um link de recuperação de senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForgotPassword(false)}>
              Cancelar
            </Button>
            <Button onClick={handleForgotPassword} disabled={isSendingReset}>
              {isSendingReset ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
