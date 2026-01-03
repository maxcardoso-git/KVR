import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import {
  Plus,
  Search,
  Copy,
  Trash2,
  RefreshCw,
  Key,
  Clock,
  Loader2,
  Code,
  AlertTriangle,
  Edit,
  ChevronLeft,
  ChevronRight,
  Workflow,
  HelpCircle,
  BookOpen,
  Lightbulb,
  Play,
  Database,
  Users,
  Layers,
  Shield,
  CheckCircle,
  Activity,
  ListTodo,
  Upload,
  Sparkles,
} from 'lucide-react'
import * as apiKeyService from '@/services/api-key.service'
import type { CreateApiKeyRequest, ApiKey } from '@/services/api-key.service'

const API_BASE_URL = window.location.origin
const ITEMS_PER_PAGE = 10

// Available scopes
const AVAILABLE_SCOPES = [
  { id: 'workflows:execute', name: 'Execute Workflows', description: 'Allows executing workflows via API' },
  { id: 'workflows:read', name: 'Read Workflows', description: 'Allows listing and viewing workflows' },
  { id: 'assistants:chat', name: 'Chat with Assistants', description: 'Allows chatting with assistants via API' },
  { id: 'assistants:read', name: 'Read Assistants', description: 'Allows listing and viewing assistants' },
  { id: 'projects:read', name: 'Read Projects', description: 'Allows listing and viewing projects' },
  { id: 'resources:read', name: 'Read Resources', description: 'Allows listing and viewing resources from Resource Registry' },
  { id: 'resources:write', name: 'Write Resources', description: 'Allows creating and updating resources in Resource Registry' },
  { id: 'users:auth', name: 'User Authentication', description: 'Allows authenticating users via External Auth API (/api/v1/external-auth)' },
  { id: 'vectorqueue:read', name: 'Read Vector Queue', description: 'Allows listing and viewing vectorization jobs from the queue' },
  { id: 'vectorqueue:write', name: 'Manage Vector Queue', description: 'Allows creating, canceling, and retrying vectorization jobs' },
  { id: 'kb:ingest', name: 'KB Ingest API', description: 'Allows ingesting documents into Knowledge Base via external API' },
  { id: 'forms:read', name: 'Read Forms', description: 'Allows listing published forms and reading their schemas for data entry' },
  { id: 'forms:submit', name: 'Submit Forms', description: 'Allows submitting data to published forms via external API' },
]

// Mock workflows for restriction
const MOCK_WORKFLOWS = [
  { id: 'wf-001', name: 'Assistente responder Formulário' },
  { id: 'wf-002', name: 'DIE Integration - Multi-Domain Router' },
  { id: 'wf-003', name: 'Business Indicator Assistant' },
  { id: 'wf-004', name: 'QA Code Agent Aquad' },
]

export default function ApiKeys() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null)
  const [integrationKey, setIntegrationKey] = useState<ApiKey | null>(null)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiKeyService.listApiKeys(),
  })

  const createMutation = useMutation({
    mutationFn: apiKeyService.createApiKey,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setNewKeySecret(result.data.key)
      setIsCreateOpen(false)
      toast({
        title: 'API Key criada',
        description: 'Certifique-se de copiar sua chave agora. Você não poderá vê-la novamente!',
      })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateApiKeyRequest> }) =>
      apiKeyService.updateApiKey(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setEditingKey(null)
      toast({ title: 'API Key atualizada', description: 'API Key atualizada com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: apiKeyService.deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      toast({ title: 'API Key deletada', description: 'API Key deletada com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: apiKeyService.regenerateApiKey,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setNewKeySecret(result.data.key)
      toast({
        title: 'API Key regenerada',
        description: 'Certifique-se de copiar sua nova chave agora!',
      })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const apiKeys = data?.data || []

  // Filter and paginate
  const filteredKeys = useMemo(() => {
    return apiKeys.filter(
      (k) =>
        k.name.toLowerCase().includes(search.toLowerCase()) ||
        k.keyPrefix.toLowerCase().includes(search.toLowerCase())
    )
  }, [apiKeys, search])

  const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE)
  const paginatedKeys = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredKeys.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredKeys, currentPage])

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copiado', description: 'Copiado para a área de transferência' })
  }

  return (
    <div className="space-y-6">
      {/* Gradient Header */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 text-white px-6 py-7 md:px-10 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/70 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Access & Permissions
            </p>
            <h1 className="text-3xl font-semibold leading-tight">API Keys Management</h1>
            <p className="text-sm text-white/80 mt-3 max-w-3xl">
              Manage API keys for external integrations. Control access, permissions and monitor usage of your APIs.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsHelpDialogOpen(true)}
              className="border-white/30 text-white hover:bg-white/20 hover:text-white gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              How it Works
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-white text-slate-900 hover:bg-white/90">
              <Plus className="h-4 w-4 mr-2" />
              New API Key
            </Button>
          </div>
        </div>
        {/* Stats Cards Inside Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
              TOTAL KEYS
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Key className="w-4 h-4 text-white" />
              </span>
            </div>
            <p className="text-3xl font-semibold mt-3">{apiKeys.length}</p>
            <p className="text-sm text-white/70 mt-1">registered</p>
          </div>
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
              ACTIVE
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </span>
            </div>
            <p className="text-3xl font-semibold mt-3">{apiKeys.filter(k => k.isActive).length}</p>
            <p className="text-sm text-white/70 mt-1">in use</p>
          </div>
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
              TOTAL CALLS
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </span>
            </div>
            <p className="text-3xl font-semibold mt-3">{apiKeys.reduce((sum, k) => sum + (k.usageCount || 0), 0)}</p>
            <p className="text-sm text-white/70 mt-1">API requests</p>
          </div>
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
              EXPIRED
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </span>
            </div>
            <p className="text-3xl font-semibold mt-3">{apiKeys.filter(k => k.expiresAt && new Date(k.expiresAt) < new Date()).length}</p>
            <p className="text-sm text-white/70 mt-1">need renewal</p>
          </div>
        </div>
      </section>

      {/* API Keys Info Card */}
      <Card className="p-6 border-none shadow-lg bg-gradient-to-r from-slate-50 to-indigo-50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Key className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Central de API Keys</h3>
            <p className="text-sm text-gray-600 mb-3">
              Gerencie chaves de API para integração com sistemas externos. Cada chave pode ter escopos específicos
              para controlar o acesso a recursos, workflows e assistentes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Database className="w-3 h-3 mr-1" />
                Resources
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Workflow className="w-3 h-3 mr-1" />
                Workflows
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Users className="w-3 h-3 mr-1" />
                External Auth
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Shield className="w-3 h-3 mr-1" />
                Scoped Access
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar API keys..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredKeys.length} {filteredKeys.length === 1 ? 'chave' : 'chaves'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredKeys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma API key encontrada</p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar sua primeira API key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedKeys.map((apiKey) => (
              <Card key={apiKey.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        {apiKey.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {apiKey.keyPrefix}...
                      </CardDescription>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        apiKey.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {apiKey.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {apiKey.description && (
                      <p className="text-sm text-muted-foreground">{apiKey.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {apiKey.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs bg-secondary px-2 py-0.5 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Usado {apiKey.usageCount} vezes</span>
                      </div>
                      {apiKey.lastUsedAt && (
                        <span>
                          Último uso: {new Date(apiKey.lastUsedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {apiKey.expiresAt && (
                        <span>
                          Expira: {new Date(apiKey.expiresAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setIntegrationKey(apiKey)}
                      >
                        <Code className="h-3 w-3 mr-1" />
                        Integration
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingKey(apiKey)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja regenerar esta chave? A chave antiga será invalidada.')) {
                            regenerateMutation.mutate(apiKey.id)
                          }
                        }}
                        disabled={regenerateMutation.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Regenerar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja deletar esta API key?')) {
                            deleteMutation.mutate(apiKey.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <ApiKeyForm
            mode="create"
            existingNames={apiKeys.map(k => k.name)}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingKey} onOpenChange={() => setEditingKey(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editingKey && (
            <ApiKeyForm
              mode="edit"
              initialData={editingKey}
              existingNames={apiKeys.filter(k => k.id !== editingKey.id).map(k => k.name)}
              onSubmit={(data) => updateMutation.mutate({ id: editingKey.id, data })}
              onCancel={() => setEditingKey(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Key Secret Dialog */}
      <Dialog open={!!newKeySecret} onOpenChange={() => setNewKeySecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Criada</DialogTitle>
            <DialogDescription>
              Certifique-se de copiar sua API key agora. Você não poderá vê-la novamente!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Sua API Key</Label>
            <div className="flex gap-2">
              <Input
                value={newKeySecret || ''}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => newKeySecret && copyToClipboard(newKeySecret)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Guarde esta chave em local seguro. Ela fornece acesso aos seus recursos.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeySecret(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integration Data Modal */}
      {integrationKey && (
        <IntegrationDataModal
          apiKey={integrationKey}
          onClose={() => setIntegrationKey(null)}
        />
      )}

      {/* How it Works Dialog */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              API Keys Documentation
            </DialogTitle>
            <DialogDescription>
              Complete guide to integrate external systems via API Keys
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="overview" className="text-xs">
                <Lightbulb className="h-3 w-3 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="resources" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Resources
              </TabsTrigger>
              <TabsTrigger value="auth" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                External Auth
              </TabsTrigger>
              <TabsTrigger value="workflows" className="text-xs">
                <Play className="h-3 w-3 mr-1" />
                Workflows
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  What are API Keys?
                </h3>
                <p className="text-sm text-muted-foreground">
                  API Keys are authentication keys that allow external systems to access
                  KVR resources without requiring user login. Each key can have
                  specific permissions (scopes) based on the type of access needed.
                </p>
              </div>

              <Separator />

              {/* Use Cases */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-indigo-500" />
                  Use Cases
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-green-200 hover:border-green-400 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Database className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-green-800">Access Resources</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Read or manage resources from the Resource Registry via API
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">resources:read</Badge>
                            <Badge variant="outline" className="text-xs">resources:write</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-200 hover:border-purple-400 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium text-purple-800">External Authentication</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Validate user credentials from external applications (SSO, mobile apps)
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">users:auth</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 hover:border-blue-400 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Play className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-blue-800">Execute Workflows</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Allow ERPs, CRMs, scripts or webhooks to trigger workflow executions
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">workflows:execute</Badge>
                            <Badge variant="outline" className="text-xs">workflows:read</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 hover:border-orange-400 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Layers className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium text-orange-800">Chat with Assistants</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Integrate AI assistants into external applications or chatbots
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">assistants:chat</Badge>
                            <Badge variant="outline" className="text-xs">assistants:read</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Authentication */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-green-500" />
                  Authentication
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  All requests require an API Key. There are two ways to send it:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4">
                      <div className="font-medium text-green-800 mb-2">✓ Recommended: X-API-Key Header</div>
                      <code className="text-xs bg-green-100 px-2 py-1 rounded block">
                        X-API-Key: kvr_your_key_here
                      </code>
                    </CardContent>
                  </Card>
                  <Card className="border-gray-200">
                    <CardContent className="pt-4">
                      <div className="font-medium text-gray-700 mb-2">Alternative: Bearer Token</div>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                        Authorization: Bearer kvr_your_key_here
                      </code>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Best Practices */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Security Best Practices
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <strong className="text-blue-800">Environment variables</strong>
                      <p className="text-blue-600">Never hardcode the key in code</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <strong className="text-blue-800">Minimal scopes</strong>
                      <p className="text-blue-600">Use only necessary permissions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <strong className="text-blue-800">Periodic rotation</strong>
                      <p className="text-blue-600">Regenerate keys regularly</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <strong className="text-blue-800">Monitor usage</strong>
                      <p className="text-blue-600">Review calls and disable unused keys</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Rate Limits */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Rate Limits
                </h3>
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Each API Key has a request limit per hour (default: 1000)</li>
                    <li>• The counter is automatically reset every hour</li>
                    <li>• When reaching the limit, you will receive error 429 with <code>Retry-After</code> header</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* RESOURCES TAB */}
            <TabsContent value="resources" className="space-y-6">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Database className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-800">Resource Registry Access</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Access and manage resources (LLMs, databases, APIs) from the Resource Registry programmatically.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="bg-white">resources:read</Badge>
                      <Badge variant="outline" className="bg-white">resources:write</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endpoints */}
              <div className="space-y-4">
                <h4 className="font-semibold">Available Endpoints</h4>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">GET</Badge>
                      <code className="text-sm">/api/v1/resources</code>
                    </div>
                    <CardDescription>Lists all resources from Resource Registry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">Scope: resources:read</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">GET</Badge>
                      <code className="text-sm">/api/v1/resources/{'{resourceId}'}</code>
                    </div>
                    <CardDescription>Gets details of a specific resource</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">POST</Badge>
                      <code className="text-sm">/api/v1/resources</code>
                    </div>
                    <CardDescription>Creates a new resource</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">Scope: resources:write</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-600">PUT</Badge>
                      <code className="text-sm">/api/v1/resources/{'{resourceId}'}</code>
                    </div>
                    <CardDescription>Updates an existing resource</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Separator />

              {/* Example */}
              <div className="space-y-4">
                <h4 className="font-semibold">Code Example</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`// List all resources
curl -X GET "${API_BASE_URL}/api/v1/resources" \\
  -H "X-API-Key: kvr_your_key_here"

// Get specific resource
curl -X GET "${API_BASE_URL}/api/v1/resources/resource_id_here" \\
  -H "X-API-Key: kvr_your_key_here"`}</pre>
                </div>
              </div>
            </TabsContent>

            {/* EXTERNAL AUTH TAB */}
            <TabsContent value="auth" className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users className="h-6 w-6 text-purple-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-purple-800">External User Authentication</h3>
                    <p className="text-sm text-purple-700 mt-1">
                      Validate user credentials from external applications like mobile apps, desktop clients, or SSO integrations.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="bg-white">Required: users:auth</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endpoint */}
              <div className="space-y-4">
                <h4 className="font-semibold">Endpoint</h4>

                <Card className="border-purple-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">POST</Badge>
                      <code className="text-sm">/api/v1/external-auth/validate</code>
                    </div>
                    <CardDescription>Validates user credentials and returns user data with JWT token</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Request Body:</Label>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded mt-1 overflow-x-auto">
                        <pre className="text-xs">{`{
  "email": "user@example.com",
  "password": "user_password"
}`}</pre>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Success Response:</Label>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded mt-1 overflow-x-auto">
                        <pre className="text-xs">{`{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}`}</pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Use Cases */}
              <div className="space-y-4">
                <h4 className="font-semibold">Common Use Cases</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-medium text-purple-800 text-sm">Mobile Applications</div>
                    <p className="text-xs text-purple-600 mt-1">
                      Authenticate users from iOS/Android apps using their KVR credentials
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-medium text-purple-800 text-sm">SSO Integration</div>
                    <p className="text-xs text-purple-600 mt-1">
                      Use as identity provider for third-party applications
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-medium text-purple-800 text-sm">Desktop Clients</div>
                    <p className="text-xs text-purple-600 mt-1">
                      Authenticate users from Electron or native desktop applications
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-medium text-purple-800 text-sm">API Gateways</div>
                    <p className="text-xs text-purple-600 mt-1">
                      Validate credentials before routing to internal services
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Example */}
              <div className="space-y-4">
                <h4 className="font-semibold">Code Example</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/external-auth/validate" \\
  -H "X-API-Key: kvr_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "user_password"
  }'`}</pre>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <strong>Important:</strong> The API Key must have the <code>users:auth</code> scope enabled.
                    This endpoint requires both the API Key (for app authentication) and user credentials
                    (for user authentication).
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* WORKFLOWS TAB */}
            <TabsContent value="workflows" className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Play className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-800">Workflow Execution</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Allow external systems (ERPs, CRMs, scripts, n8n, Make) to trigger workflow executions via API.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="bg-white">Required: workflows:execute</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endpoints */}
              <div className="space-y-4">
                <h4 className="font-semibold">Available Endpoints</h4>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">POST</Badge>
                      <code className="text-sm">/api/v1/workflows/{'{workflowId}'}/execute</code>
                    </div>
                    <CardDescription>Executes a workflow and returns the result</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Body (JSON):</Label>
                      <div className="bg-gray-900 text-gray-100 p-3 rounded mt-1 overflow-x-auto">
                        <pre className="text-xs">{`{
  "params": {
    "key1": "value1",
    "key2": "value2"
  },
  "async": false  // true for async execution
}`}</pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">GET</Badge>
                      <code className="text-sm">/api/v1/workflows</code>
                    </div>
                    <CardDescription>Lists workflows available for your API Key</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">GET</Badge>
                      <code className="text-sm">/api/v1/workflows/runs/{'{runId}'}</code>
                    </div>
                    <CardDescription>Queries the status of an async execution</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Separator />

              {/* Examples */}
              <div className="space-y-4">
                <h4 className="font-semibold">Code Examples</h4>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-gray-800 text-white px-2 py-0.5 rounded">cURL</span>
                  </Label>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/workflows/YOUR_WORKFLOW_ID/execute" \\
  -H "X-API-Key: kvr_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"params": {"message": "Hello!"}}'`}</pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">JavaScript</span>
                  </Label>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-xs">{`const response = await fetch(
  '${API_BASE_URL}/api/v1/workflows/YOUR_WORKFLOW_ID/execute',
  {
    method: 'POST',
    headers: {
      'X-API-Key': 'kvr_your_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ params: { message: 'Hello!' } })
  }
);
const result = await response.json();`}</pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-orange-600 text-white px-2 py-0.5 rounded">n8n / Make</span>
                  </Label>
                  <div className="bg-gray-50 border p-4 rounded-lg space-y-2 text-sm">
                    <div><strong>URL:</strong> <code>{API_BASE_URL}/api/v1/workflows/YOUR_WORKFLOW_ID/execute</code></div>
                    <div><strong>Method:</strong> POST</div>
                    <div><strong>Headers:</strong> X-API-Key: <code>kvr_your_key_here</code></div>
                    <div><strong>Body:</strong> JSON with workflow parameters</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setIsHelpDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Form interface
interface ApiKeyFormData {
  name: string
  description: string
  scopes: string[]
  rateLimit: number
  expiresAt: string
  restrictedWorkflows: string[]
}

function ApiKeyForm({
  mode,
  initialData,
  existingNames,
  onSubmit,
  onCancel,
  isLoading,
}: {
  mode: 'create' | 'edit'
  initialData?: ApiKey
  existingNames: string[]
  onSubmit: (data: CreateApiKeyRequest) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    scopes: initialData?.scopes || [],
    rateLimit: initialData?.rateLimit || 1000,
    expiresAt: initialData?.expiresAt ? initialData.expiresAt.split('T')[0] : '',
    restrictedWorkflows: [],
  })
  const [nameError, setNameError] = useState<string | null>(null)

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError('Nome é obrigatório')
      return false
    }
    if (existingNames.some(n => n.toLowerCase() === name.toLowerCase())) {
      setNameError('Já existe uma API Key com este nome')
      return false
    }
    setNameError(null)
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateName(formData.name)) return

    onSubmit({
      name: formData.name,
      description: formData.description,
      scopes: formData.scopes,
      rateLimit: formData.rateLimit,
      expiresAt: formData.expiresAt || undefined,
    })
  }

  const toggleScope = (scopeId: string) => {
    if (formData.scopes.includes(scopeId)) {
      setFormData({
        ...formData,
        scopes: formData.scopes.filter((s) => s !== scopeId),
      })
    } else {
      setFormData({
        ...formData,
        scopes: [...formData.scopes, scopeId],
      })
    }
  }

  const toggleWorkflow = (workflowId: string) => {
    if (formData.restrictedWorkflows.includes(workflowId)) {
      setFormData({
        ...formData,
        restrictedWorkflows: formData.restrictedWorkflows.filter((w) => w !== workflowId),
      })
    } else {
      setFormData({
        ...formData,
        restrictedWorkflows: [...formData.restrictedWorkflows, workflowId],
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? 'Criar API Key' : 'Editar API Key'}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Crie uma nova API key para integrações externas'
            : 'Atualize as configurações da API key'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value })
              if (nameError) validateName(e.target.value)
            }}
            onBlur={() => validateName(formData.name)}
            placeholder="My API Key"
            className={nameError ? 'border-red-500' : ''}
            required
          />
          {nameError && (
            <p className="text-xs text-red-500">{nameError}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Usado para..."
          />
        </div>

        {/* Scopes */}
        <div className="space-y-2">
          <Label>Scopes</Label>
          <div className="grid gap-2 max-h-64 overflow-auto border rounded-lg p-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                  formData.scopes.includes(scope.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
                )}
              >
                <input
                  type="checkbox"
                  checked={formData.scopes.includes(scope.id)}
                  onChange={() => toggleScope(scope.id)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium">{scope.name}</p>
                  <p className="text-xs text-muted-foreground">{scope.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Restrict to Specific Workflows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Restringir a Workflows Específicos</Label>
            {formData.restrictedWorkflows.length > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                {formData.restrictedWorkflows.length} selecionado{formData.restrictedWorkflows.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe vazio para permitir acesso a todos os workflows. Selecione workflows específicos para restringir.
          </p>
          <div className="grid gap-2 max-h-40 overflow-auto border rounded-lg p-2">
            {MOCK_WORKFLOWS.map((workflow) => (
              <label
                key={workflow.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors',
                  formData.restrictedWorkflows.includes(workflow.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
                )}
              >
                <input
                  type="checkbox"
                  checked={formData.restrictedWorkflows.includes(workflow.id)}
                  onChange={() => toggleWorkflow(workflow.id)}
                />
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{workflow.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Rate Limit and Expiration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rateLimit">Rate Limit (req/hora)</Label>
            <Input
              id="rateLimit"
              type="number"
              value={formData.rateLimit}
              onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) || 1000 })}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Data de Expiração</Label>
            <Input
              id="expiresAt"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !!nameError}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Criar API Key' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function IntegrationDataModal({
  apiKey,
  onClose,
}: {
  apiKey: ApiKey
  onClose: () => void
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copiado', description: 'Copiado para a área de transferência' })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600" />
            Integration Data: {apiKey.name}
          </DialogTitle>
          <DialogDescription>
            Use this information to integrate external systems with this API Key
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API Key Information */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-blue-800 flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key Information
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Label className="text-blue-600">Name:</Label>
                <div className="font-medium">{apiKey.name}</div>
              </div>
              <div>
                <Label className="text-blue-600">Prefix:</Label>
                <div className="font-mono">{apiKey.keyPrefix}...</div>
              </div>
              <div>
                <Label className="text-blue-600">Rate Limit:</Label>
                <div className="font-medium">{apiKey.rateLimit || 1000} req/hora</div>
              </div>
              <div>
                <Label className="text-blue-600">Scopes:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {apiKey.scopes?.map(scope => (
                    <Badge key={scope} variant="outline" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Authentication Header */}
          <div className="bg-gray-50 border p-4 rounded-lg space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-green-600" />
              Authentication Header
            </h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-900 text-gray-100 px-3 py-2 rounded font-mono">
                X-API-Key: {apiKey.keyPrefix}...[sua chave completa]
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(`X-API-Key: `)}
                title="Copiar formato do header"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              A chave completa só é exibida uma vez, no momento da criação. Copie-a e guarde em local seguro.
            </p>
          </div>

          <Separator />

          {/* Tabs baseadas nos Scopes */}
          <Tabs defaultValue={
            apiKey.scopes?.some(s => s.includes('workflow')) ? 'workflows' :
            apiKey.scopes?.some(s => s.includes('resource')) ? 'resources' :
            apiKey.scopes?.some(s => s.includes('users:auth')) ? 'auth' :
            apiKey.scopes?.some(s => s.includes('assistant')) ? 'assistants' :
            apiKey.scopes?.some(s => s.includes('vectorqueue')) ? 'vectorqueue' :
            apiKey.scopes?.some(s => s.includes('kb-ingest')) ? 'kb-ingest' :
            apiKey.scopes?.some(s => s.includes('forms')) ? 'forms' :
            'workflows'
          } className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-4">
              <TabsTrigger
                value="workflows"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('workflow'))}
              >
                <Play className="h-3 w-3 mr-1" />
                Workflows
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('resource'))}
              >
                <Database className="h-3 w-3 mr-1" />
                Resources
              </TabsTrigger>
              <TabsTrigger
                value="auth"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('users:auth'))}
              >
                <Users className="h-3 w-3 mr-1" />
                External Auth
              </TabsTrigger>
              <TabsTrigger
                value="assistants"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('assistant'))}
              >
                <Layers className="h-3 w-3 mr-1" />
                Assistants
              </TabsTrigger>
              <TabsTrigger
                value="vectorqueue"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('vectorqueue'))}
              >
                <ListTodo className="h-3 w-3 mr-1" />
                Vector Queue
              </TabsTrigger>
              <TabsTrigger
                value="kb-ingest"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('kb-ingest'))}
              >
                <Upload className="h-3 w-3 mr-1" />
                KB Ingest
              </TabsTrigger>
              <TabsTrigger
                value="forms"
                className="text-xs"
                disabled={!apiKey.scopes?.some(s => s.includes('forms'))}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Forms
              </TabsTrigger>
            </TabsList>

            {/* ==================== WORKFLOWS TAB ==================== */}
            <TabsContent value="workflows" className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-800">
                <CheckCircle className="h-4 w-4 inline mr-2" />
                Execute workflows via API
              </div>

              {/* Endpoint */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoint</Label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">POST</Badge>
                  <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                    {API_BASE_URL}/api/v1/workflows/{'{workflowId}'}/execute
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/workflows/{workflowId}/execute`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="font-mono text-xs bg-gray-800 text-white px-2 py-0.5 rounded">cURL</span>
                    Example
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/workflows/YOUR_WORKFLOW_ID/execute" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"params": {"message": "Hello!"}}'`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/workflows/YOUR_WORKFLOW_ID/execute" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"params": {"message": "Hello!"}}'`}</pre>
                </div>
              </div>

              {/* JavaScript Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="font-mono text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">JS</span>
                    Example
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`const res = await fetch('${API_BASE_URL}/api/v1/workflows/WORKFLOW_ID/execute', {
  method: 'POST',
  headers: { 'X-API-Key': '${apiKey.keyPrefix}...KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ params: { message: 'Hello!' } })
});`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`const res = await fetch('${API_BASE_URL}/api/v1/workflows/WORKFLOW_ID/execute', {
  method: 'POST',
  headers: { 'X-API-Key': '${apiKey.keyPrefix}...KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ params: { message: 'Hello!' } })
});`}</pre>
                </div>
              </div>
            </TabsContent>

            {/* ==================== RESOURCES TAB ==================== */}
            <TabsContent value="resources" className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <Database className="h-4 w-4 inline mr-2 text-green-600" />
                <span className="text-sm text-green-800">Access resources from the Resource Registry</span>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoints</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/resources
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/resources`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/resources/{'{resourceId}'}
                    </code>
                  </div>
                  {apiKey.scopes?.includes('resources:write') && (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">POST</Badge>
                      <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                        {API_BASE_URL}/api/v1/resources
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">cURL Example</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X GET "${API_BASE_URL}/api/v1/resources" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY"`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X GET "${API_BASE_URL}/api/v1/resources" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY"`}</pre>
                </div>
              </div>
            </TabsContent>

            {/* ==================== EXTERNAL AUTH TAB ==================== */}
            <TabsContent value="auth" className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                <Users className="h-4 w-4 inline mr-2 text-purple-600" />
                <span className="text-sm text-purple-800">Validate user credentials from external applications</span>
              </div>

              {/* Endpoint */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoint</Label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">POST</Badge>
                  <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                    {API_BASE_URL}/api/v1/external-auth/validate
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/external-auth/validate`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">cURL Example</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/external-auth/validate" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "user_password"}'`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/external-auth/validate" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "user_password"}'`}</pre>
                </div>
              </div>

              {/* Response Example */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Success Response</Label>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`{
  "success": true,
  "data": {
    "valid": true,
    "user": { "id": "...", "email": "...", "name": "...", "role": "..." }
  }
}`}</pre>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                This endpoint validates user credentials. Use for mobile apps, desktop clients, or SSO integrations.
              </div>
            </TabsContent>

            {/* ==================== ASSISTANTS TAB ==================== */}
            <TabsContent value="assistants" className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <Layers className="h-4 w-4 inline mr-2 text-orange-600" />
                <span className="text-sm text-orange-800">Chat with AI Assistants from external applications</span>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoints</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/assistants
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/assistants`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/assistants/{'{assistantId}'}/chat
                    </code>
                  </div>
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">cURL Example</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/assistants/ASSISTANT_ID/chat" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "sessionId": "session_123"}'`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/assistants/ASSISTANT_ID/chat" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "sessionId": "session_123"}'`}</pre>
                </div>
              </div>

              {/* Use Cases */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-orange-50 rounded text-xs">
                  <strong>Website Chatbots</strong>
                  <p className="text-orange-600">Embed AI on your website</p>
                </div>
                <div className="p-2 bg-orange-50 rounded text-xs">
                  <strong>Messaging Bots</strong>
                  <p className="text-orange-600">WhatsApp, Telegram, etc</p>
                </div>
              </div>
            </TabsContent>

            {/* ==================== VECTOR QUEUE TAB ==================== */}
            <TabsContent value="vectorqueue" className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                <ListTodo className="h-4 w-4 inline mr-2 text-purple-600" />
                <span className="text-sm text-purple-800">Manage vectorization jobs for AI embeddings and similarity search</span>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoints</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/vector-queue/jobs
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/vector-queue/jobs`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/vector-queue/stats
                    </code>
                  </div>
                  {apiKey.scopes?.includes('vectorqueue:write') && (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">POST</Badge>
                        <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {API_BASE_URL}/api/v1/vector-queue/jobs
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-600">POST</Badge>
                        <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {API_BASE_URL}/api/v1/vector-queue/jobs/{'{jobId}'}/cancel
                        </code>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Create Vectorization Job</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/vector-queue/jobs" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataSource": "CONTEXT",
    "indicatorId": "your_indicator_id",
    "orgId": "your_org_id",
    "priority": 5
  }'`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/vector-queue/jobs" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataSource": "CONTEXT",
    "indicatorId": "your_indicator_id",
    "orgId": "your_org_id",
    "priority": 5
  }'`}</pre>
                </div>
              </div>

              {/* Data Sources */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Data Sources</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-purple-50 rounded text-xs">
                    <strong>CONTEXT</strong>
                    <p className="text-purple-600">Documents and text content</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded text-xs">
                    <strong>TIMESERIES</strong>
                    <p className="text-purple-600">Time-based metrics</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded text-xs">
                    <strong>FEATURES</strong>
                    <p className="text-purple-600">Feature vectors</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded text-xs">
                    <strong>ALERTS</strong>
                    <p className="text-purple-600">Alert notifications</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ==================== KB INGEST TAB ==================== */}
            <TabsContent value="kb-ingest" className="space-y-4">
              <div className="bg-cyan-50 border border-cyan-200 p-3 rounded-lg">
                <Upload className="h-4 w-4 inline mr-2 text-cyan-600" />
                <span className="text-sm text-cyan-800">Ingest documents into Knowledge Base for RAG</span>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoints</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/kb-ingest/upload
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/kb-ingest/upload`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">POST</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/kb-ingest/url
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/kb-ingest/status/{'{documentId}'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">GET</Badge>
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      {API_BASE_URL}/api/v1/kb-ingest/stats
                    </code>
                  </div>
                </div>
              </div>

              {/* cURL Example - Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Upload Document</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/kb-ingest/upload" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -F "file=@document.pdf" \\
  -F "namespaceId=your_namespace_id" \\
  -F "metadata={\\"source\\": \\"external\\"}" \\
  -F "priority=normal"`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/kb-ingest/upload" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -F "file=@document.pdf" \\
  -F "namespaceId=your_namespace_id" \\
  -F "metadata={\\"source\\": \\"external\\"}" \\
  -F "priority=normal"`}</pre>
                </div>
              </div>

              {/* Supported File Types */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Supported File Types</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>PDF</strong>
                  </div>
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>TXT</strong>
                  </div>
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>Markdown</strong>
                  </div>
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>DOCX</strong>
                  </div>
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>CSV</strong>
                  </div>
                  <div className="p-2 bg-cyan-50 rounded text-xs text-center">
                    <strong>JSON</strong>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ==================== FORMS TAB ==================== */}
            <TabsContent value="forms" className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <Sparkles className="h-4 w-4 inline mr-2 text-emerald-600" />
                <span className="text-sm text-emerald-800">Submit data to published forms from external applications</span>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Endpoints</Label>
                <div className="space-y-2">
                  {apiKey.scopes?.includes('forms:read') && (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600">GET</Badge>
                        <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {API_BASE_URL}/api/v1/data-entry-forms/external/list
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/data-entry-forms/external/list`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600">GET</Badge>
                        <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {API_BASE_URL}/api/v1/data-entry-forms/external/{'{formId}'}/schema
                        </code>
                      </div>
                    </>
                  )}
                  {apiKey.scopes?.includes('forms:submit') && (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">POST</Badge>
                      <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded">
                        {API_BASE_URL}/api/v1/data-entry-forms/external/{'{formId}'}/submit
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* cURL Example - List Forms */}
              {apiKey.scopes?.includes('forms:read') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">List Published Forms</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(`curl -X GET "${API_BASE_URL}/api/v1/data-entry-forms/external/list" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY"`)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                    <pre className="text-xs">{`curl -X GET "${API_BASE_URL}/api/v1/data-entry-forms/external/list" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY"`}</pre>
                  </div>
                </div>
              )}

              {/* cURL Example - Submit Data */}
              {apiKey.scopes?.includes('forms:submit') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Submit Form Data</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(`curl -X POST "${API_BASE_URL}/api/v1/data-entry-forms/external/form_xxxxxxxx/submit" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "rating": 5
    }
  }'`)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                    <pre className="text-xs">{`curl -X POST "${API_BASE_URL}/api/v1/data-entry-forms/external/form_xxxxxxxx/submit" \\
  -H "X-API-Key: ${apiKey.keyPrefix}...YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "rating": 5
    }
  }'`}</pre>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 inline mr-2 text-amber-600" />
                <span className="text-xs text-amber-800">
                  <strong>Note:</strong> Only <strong>PUBLISHED</strong> forms are available via the external API.
                </span>
              </div>
            </TabsContent>
          </Tabs>

          {/* Dica */}
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <strong>Important:</strong> Replace <code>{apiKey.keyPrefix}...YOUR_FULL_KEY</code> with the full API Key you saved during creation.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
