import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Play,
  Heart,
  Globe,
  Copy,
  Loader2,
  X,
  ArrowUpCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  HelpCircle,
  Database,
  Activity,
  Layers,
  Lightbulb,
  FileText,
  MessageSquare,
  Code,
  Brain,
  Shield,
  Workflow,
  Zap,
  BookOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import * as resourceService from '@/services/resource.service'
import * as projectService from '@/services/project.service'
import type { Resource, CreateResourceRequest } from '@/services/resource.service'

// Resource types configuration
const RESOURCE_TYPES = [
  { id: 'HTTP', name: 'API HTTP (Outbound)', icon: 'Globe', color: 'text-blue-500' },
  { id: 'WEBHOOK', name: 'Webhook (Inbound)', icon: 'Webhook', color: 'text-emerald-500' },
  { id: 'DB', name: 'Database', icon: 'Database', color: 'text-purple-500' },
  { id: 'FILE', name: 'File/NFS', icon: 'FileText', color: 'text-green-500' },
  { id: 'MESSAGE', name: 'Messaging', icon: 'MessageSquare', color: 'text-orange-500' },
  { id: 'SLACK', name: 'Slack', icon: 'MessageSquare', color: 'text-purple-600' },
  { id: 'TEAMS', name: 'Microsoft Teams', icon: 'MessageSquare', color: 'text-blue-600' },
  { id: 'TELEGRAM', name: 'Telegram', icon: 'MessageSquare', color: 'text-sky-500' },
  { id: 'FUNCTION', name: 'Function/Script', icon: 'Code', color: 'text-indigo-500' },
  { id: 'EMBEDDING', name: 'Embedding Function', icon: 'Brain', color: 'text-amber-500' },
  { id: 'VECTOR_ENGINE', name: 'Vector Engine', icon: 'Boxes', color: 'text-rose-500' },
  { id: 'DATA_LAYER', name: 'Data Layer', icon: 'Layers', color: 'text-cyan-500' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const SENSITIVITY_LEVELS = [
  { id: 'LOW', name: 'Baixa' },
  { id: 'MEDIUM', name: 'Média' },
  { id: 'HIGH', name: 'Alta' },
  { id: 'CRITICAL', name: 'Crítica' },
]

const VISIBILITY_OPTIONS = [
  { id: 'PUBLIC', name: 'Público' },
  { id: 'ORGANIZATION', name: 'Organização' },
  { id: 'PROJECT_ONLY', name: 'Apenas Projeto' },
  { id: 'ADMIN_ONLY', name: 'Apenas Admins' },
]

const AUTH_MODES = [
  { id: 'NONE', name: 'Nenhuma' },
  { id: 'API_KEY', name: 'API Key' },
  { id: 'BEARER', name: 'Bearer Token' },
  { id: 'BASIC', name: 'Basic Auth' },
  { id: 'OAUTH2', name: 'OAuth 2.0' },
  { id: 'JWT', name: 'JWT' },
  { id: 'AWS', name: 'AWS Signature' },
  { id: 'CUSTOM', name: 'Custom Header' },
]

// LLM Providers with their models
const LLM_PROVIDERS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  none: { label: 'Não é LLM', models: [] },
  openai: {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (Flagship)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'o1-preview', label: 'O1 Preview (Reasoning)' },
      { value: 'o1-mini', label: 'O1 Mini (Reasoning)' },
    ]
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Latest)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ]
  },
  google: {
    label: 'Google (Gemini)',
    models: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Latest)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ]
  },
  azure: {
    label: 'Azure OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (Azure)' },
      { value: 'gpt-4', label: 'GPT-4 (Azure)' },
      { value: 'gpt-35-turbo', label: 'GPT-3.5 Turbo (Azure)' },
    ]
  },
  groq: {
    label: 'Groq',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Instant)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ]
  },
  ollama: {
    label: 'Ollama (Local)',
    models: [
      { value: 'llama3.2', label: 'Llama 3.2' },
      { value: 'llama3.1', label: 'Llama 3.1' },
      { value: 'mistral', label: 'Mistral' },
      { value: 'codellama', label: 'Code Llama' },
    ]
  },
  custom: {
    label: 'Custom/Outro',
    models: []
  }
}

// Vector Engine Providers
const VECTOR_PROVIDERS = [
  { id: 'pinecone', name: 'Pinecone' },
  { id: 'weaviate', name: 'Weaviate' },
  { id: 'qdrant', name: 'Qdrant' },
  { id: 'pgvector', name: 'PgVector (PostgreSQL)' },
  { id: 'chromadb', name: 'ChromaDB' },
  { id: 'milvus', name: 'Milvus' },
]

// Data Layer Types
const DATA_LAYER_TYPES = [
  { id: 'feature_store', name: 'Feature Store' },
  { id: 'timeseries', name: 'Time Series' },
  { id: 'kpi_metrics', name: 'KPI Metrics' },
  { id: 'aggregations', name: 'Aggregations' },
]

export default function Resources() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'DEV' | 'PRD'>('DEV')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [subtypeFilter, setSubtypeFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Promotion dialog states
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false)
  const [resourceToPromote, setResourceToPromote] = useState<Resource | null>(null)
  const [promotionNotes, setPromotionNotes] = useState('')
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [resourceToApprove, setResourceToApprove] = useState<Resource | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')

  // Help dialog state
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [resourceToDuplicate, setResourceToDuplicate] = useState<Resource | null>(null)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateEnv, setDuplicateEnv] = useState<'DEV' | 'PRD'>('DEV')

  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => resourceService.listResources(),
  })

  const createMutation = useMutation({
    mutationFn: resourceService.createResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setIsCreateOpen(false)
      toast({ title: 'Resource criado', description: 'Resource criado com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateResourceRequest> }) =>
      resourceService.updateResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setEditingResource(null)
      toast({ title: 'Resource atualizado', description: 'Resource atualizado com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: resourceService.deleteResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast({ title: 'Resource deletado', description: 'Resource deletado com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const testMutation = useMutation({
    mutationFn: resourceService.testResource,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setTestingId(null)
      if (result.data.success) {
        toast({ title: 'Teste passou', description: result.data.message })
      } else {
        toast({ title: 'Teste falhou', description: result.data.message, variant: 'destructive' })
      }
    },
    onError: (error: Error) => {
      setTestingId(null)
      toast({ title: 'Erro no teste', description: error.message, variant: 'destructive' })
    },
  })

  const handleTest = (id: string) => {
    setTestingId(id)
    testMutation.mutate(id)
  }

  // Promotion mutations
  const promoteMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      resourceService.promoteResource(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setPromotionDialogOpen(false)
      setResourceToPromote(null)
      setPromotionNotes('')
      toast({ title: 'Promoção solicitada', description: 'Solicitação de promoção enviada com sucesso' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      resourceService.approveResource(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setApprovalDialogOpen(false)
      setResourceToApprove(null)
      setApprovalAction(null)
      setApprovalNotes('')
      toast({ title: 'Promoção aprovada', description: 'O recurso foi promovido para PRD' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      resourceService.rejectResource(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      setApprovalDialogOpen(false)
      setResourceToApprove(null)
      setApprovalAction(null)
      setApprovalNotes('')
      toast({ title: 'Promoção rejeitada', description: 'A promoção foi rejeitada' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    },
  })

  // Promotion handlers
  const handleOpenPromotionDialog = (resource: Resource) => {
    setResourceToPromote(resource)
    setPromotionNotes('')
    setPromotionDialogOpen(true)
  }

  const handleConfirmPromotion = () => {
    if (!resourceToPromote) return
    promoteMutation.mutate({ id: resourceToPromote.id, notes: promotionNotes })
  }

  const handleOpenApprovalDialog = (resource: Resource, action: 'approve' | 'reject') => {
    setResourceToApprove(resource)
    setApprovalAction(action)
    setApprovalNotes('')
    setApprovalDialogOpen(true)
  }

  const handleConfirmApproval = () => {
    if (!resourceToApprove || !approvalAction) return
    if (approvalAction === 'approve') {
      approveMutation.mutate({ id: resourceToApprove.id, notes: approvalNotes })
    } else {
      rejectMutation.mutate({ id: resourceToApprove.id, notes: approvalNotes })
    }
  }

  // Duplicate handlers
  const buildDuplicateName = (name: string): string => {
    const copyMatch = name.match(/^(.+?)\s*\(cópia(?:\s+(\d+))?\)$/)
    if (copyMatch) {
      const baseName = copyMatch[1]
      const copyNumber = copyMatch[2] ? parseInt(copyMatch[2], 10) + 1 : 2
      return `${baseName} (cópia ${copyNumber})`
    }
    return `${name} (cópia)`
  }

  const handleOpenDuplicateDialog = (resource: Resource) => {
    setResourceToDuplicate(resource)
    setDuplicateName(buildDuplicateName(resource.name))
    setDuplicateEnv('DEV')
    setDuplicateDialogOpen(true)
  }

  const handleConfirmDuplicate = () => {
    if (!resourceToDuplicate || !duplicateName.trim()) return

    // Build the duplicate resource data
    const duplicateData: CreateResourceRequest = {
      name: duplicateName.trim(),
      type: resourceToDuplicate.type,
      subtype: resourceToDuplicate.subtype,
      endpoint: resourceToDuplicate.endpoint,
      method: resourceToDuplicate.method,
      config: resourceToDuplicate.config,
      // Note: We don't copy auth credentials for security reasons
      auth: undefined,
      connection: resourceToDuplicate.connection,
      metadata: resourceToDuplicate.metadata,
      isActive: false, // Start as inactive
      env: duplicateEnv,
      sensitivity: resourceToDuplicate.sensitivity,
      visibility: resourceToDuplicate.visibility,
      tags: resourceToDuplicate.tags ? [...resourceToDuplicate.tags] : [],
    }

    createMutation.mutate(duplicateData, {
      onSuccess: () => {
        setDuplicateDialogOpen(false)
        setResourceToDuplicate(null)
        setDuplicateName('')
        toast({
          title: 'Recurso duplicado',
          description: `"${duplicateName}" foi criado com sucesso. Lembre-se de configurar as credenciais.`,
        })
      },
    })
  }

  const resources = data?.data || []

  // Count resources by environment
  const { devCount, prdCount, devDownCount, pendingApprovalsCount, healthyCount, testedCount, pendingTestsCount } = useMemo(() => {
    const dev = resources.filter(r => r.env === 'DEV')
    const prd = resources.filter(r => r.env === 'PRD')
    const devDown = dev.filter(r => r.health?.status === 'DOWN' || r.health?.status === 'ERROR')
    const pendingApprovals = resources.filter(r => r.promotionStatus === 'PENDING_APPROVAL')
    const healthy = resources.filter(r => r.health?.status === 'OK' || r.health?.status === 'UP')
    const tested = resources.filter(r => r.health?.status)
    return {
      devCount: dev.length,
      prdCount: prd.length,
      devDownCount: devDown.length,
      pendingApprovalsCount: pendingApprovals.length,
      healthyCount: healthy.length,
      testedCount: tested.length,
      pendingTestsCount: resources.length - tested.length,
    }
  }, [resources])

  // Summary cards for the header
  const summaryCards = [
    {
      id: 'total',
      label: 'REGISTERED RESOURCES',
      value: resources.length,
      sublabel: `${healthyCount} healthy`,
      icon: Database,
    },
    {
      id: 'tested',
      label: 'RECENTLY TESTED',
      value: testedCount,
      sublabel: `${pendingTestsCount} pending`,
      icon: Activity,
    },
    {
      id: 'types',
      label: 'SUPPORTED TYPES',
      value: RESOURCE_TYPES.length,
      sublabel: 'integration models',
      icon: Layers,
    },
  ]

  // Get unique subtypes for filter dropdown
  const availableSubtypes = useMemo(() => {
    const subtypes = new Set<string>()
    resources.forEach((r) => {
      if (r.subtype) subtypes.add(r.subtype)
    })
    return Array.from(subtypes).sort()
  }, [resources])

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      const matchesEnv = r.env === activeTab
      const matchesSearch = search === '' ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
        r.subtype?.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'all' || r.type === typeFilter
      const matchesSubtype = subtypeFilter === 'all' || r.subtype === subtypeFilter
      return matchesEnv && matchesSearch && matchesType && matchesSubtype
    })
  }, [resources, activeTab, search, typeFilter, subtypeFilter])

  return (
    <div className="space-y-6">
      {/* Gradient Header */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 text-white px-6 py-7 md:px-10 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/70 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Registry & Credentials
            </p>
            <h1 className="text-3xl font-semibold leading-tight">Connector Resources Registry</h1>
            <p className="text-sm text-white/80 mt-3 max-w-3xl">
              Centralize APIs, databases, and messaging systems with health visibility via MCP testing. Use them as building blocks in your workflows.
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
              Novo Resource
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {summaryCards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.id}
                className="rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
                  {card.label}
                  <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                  </span>
                </div>
                <p className="text-3xl font-semibold mt-3">{card.value}</p>
                <p className="text-sm text-white/70 mt-1">{card.sublabel}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Central de Integrações Info Card */}
      <Card className="p-6 border-none shadow-lg bg-gradient-to-r from-slate-50 to-indigo-50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Central de Integrações</h3>
            <p className="text-sm text-gray-600 mb-3">
              Recursos são a ponte entre seus workflows e sistemas externos. Cada recurso cadastrado
              pode ser reutilizado em múltiplos fluxos, centralizando credenciais e configurações.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Globe className="w-3 h-3 mr-1" />
                APIs REST
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Database className="w-3 h-3 mr-1" />
                Bancos de Dados
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <MessageSquare className="w-3 h-3 mr-1" />
                Mensageria
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Brain className="w-3 h-3 mr-1" />
                Embeddings
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => setActiveTab('DEV')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'DEV'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="text-orange-500">&lt;&gt;</span>
          Development ({devCount})
          {devDownCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {devDownCount}
            </span>
          )}
          {pendingApprovalsCount > 0 && (
            <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('PRD')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'PRD'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="text-green-500">≡</span>
          Production ({prdCount})
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, endpoint ou subtipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos os tipos</option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          <select
            value={subtypeFilter}
            onChange={(e) => setSubtypeFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos os subtipos</option>
            {availableSubtypes.map((subtype) => (
              <option key={subtype} value={subtype}>{subtype}</option>
            ))}
          </select>
          {(typeFilter !== 'all' || subtypeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTypeFilter('all')
                setSubtypeFilter('all')
              }}
              className="h-10"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Resources List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredResources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum resource encontrado</p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro resource
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onTest={() => handleTest(resource.id)}
              onEdit={() => setEditingResource(resource)}
              onDelete={() => {
                if (confirm('Tem certeza que deseja deletar este resource?')) {
                  deleteMutation.mutate(resource.id)
                }
              }}
              onDuplicate={() => handleOpenDuplicateDialog(resource)}
              onPromote={() => handleOpenPromotionDialog(resource)}
              onApprove={() => handleOpenApprovalDialog(resource, 'approve')}
              onReject={() => handleOpenApprovalDialog(resource, 'reject')}
              isTesting={testingId === resource.id}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <ResourceForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingResource} onOpenChange={() => setEditingResource(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {editingResource && (
            <ResourceForm
              initialData={editingResource}
              onSubmit={(data) => updateMutation.mutate({ id: editingResource.id, data })}
              onCancel={() => setEditingResource(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Promotion Request Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Promoção para PRD</DialogTitle>
            <DialogDescription>
              Solicite a promoção do recurso <strong>{resourceToPromote?.name}</strong> para o ambiente de produção.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
              <p className="text-sm text-blue-900 font-semibold mb-1">
                {resourceToPromote?.name}
              </p>
              <p className="text-xs text-blue-700">
                Tipo: {RESOURCE_TYPES.find(t => t.id === resourceToPromote?.type)?.name || resourceToPromote?.type}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotion-notes">Notas da Promoção</Label>
              <textarea
                id="promotion-notes"
                placeholder="Descreva as mudanças, testes realizados, etc."
                value={promotionNotes}
                onChange={(e) => setPromotionNotes(e.target.value)}
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Informe detalhes sobre as mudanças e testes realizados
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPromotionDialogOpen(false)
                setResourceToPromote(null)
                setPromotionNotes('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPromotion}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={promoteMutation.isPending}
            >
              {promoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Solicitar Promoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval/Rejection Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Aprovar Promoção' : 'Rejeitar Promoção'}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' ? (
                <>
                  Aprovar a promoção de <strong>{resourceToApprove?.name}</strong> criará um novo recurso PRD.
                  <br />
                  <strong className="text-amber-600">Atenção:</strong> As credenciais NÃO serão copiadas. Você deverá preenchê-las manualmente.
                </>
              ) : (
                <>
                  Rejeitar a promoção de <strong>{resourceToApprove?.name}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
              <p className="text-sm text-amber-900 font-semibold mb-1">
                {resourceToApprove?.name}
              </p>
              <p className="text-xs text-amber-700">
                Tipo: {RESOURCE_TYPES.find(t => t.id === resourceToApprove?.type)?.name || resourceToApprove?.type}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notas</Label>
              <textarea
                id="approval-notes"
                placeholder={approvalAction === 'approve' ? "Motivo da aprovação" : "Motivo da rejeição"}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovalDialogOpen(false)
                setResourceToApprove(null)
                setApprovalAction(null)
                setApprovalNotes('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmApproval}
              className={approvalAction === 'approve' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {approvalAction === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Duplicar Recurso
            </DialogTitle>
            <DialogDescription>
              Criar uma cópia de <strong>{resourceToDuplicate?.name}</strong>.
              <br />
              <span className="text-amber-600 text-xs font-medium">
                Atenção: As credenciais de autenticação NÃO serão copiadas por segurança.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 font-semibold mb-1">
                {resourceToDuplicate?.name}
              </p>
              <p className="text-xs text-blue-700">
                Tipo: {RESOURCE_TYPES.find(t => t.id === resourceToDuplicate?.type)?.name || resourceToDuplicate?.type}
              </p>
              {resourceToDuplicate?.endpoint && (
                <p className="text-xs text-blue-600 font-mono truncate mt-1">
                  {resourceToDuplicate.endpoint}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-name">Nome do novo recurso</Label>
              <Input
                id="duplicate-name"
                placeholder="Nome do recurso duplicado"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-env">Ambiente</Label>
              <select
                id="duplicate-env"
                value={duplicateEnv}
                onChange={(e) => setDuplicateEnv(e.target.value as 'DEV' | 'PRD')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="DEV">DEV (Desenvolvimento)</option>
                <option value="PRD">PRD (Produção)</option>
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
              <ul className="list-disc list-inside space-y-1">
                <li>O recurso será criado como <strong>inativo</strong></li>
                <li>Você precisará configurar as credenciais manualmente</li>
                <li>Faça um teste de conexão após configurar</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateDialogOpen(false)
                setResourceToDuplicate(null)
                setDuplicateName('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDuplicate}
              disabled={!duplicateName.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Copy className="w-4 h-4" />
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Dialog - How it Works */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Layers className="w-6 h-6 text-indigo-600" />
              Connector Resources Registry
            </DialogTitle>
            <DialogDescription>
              Learn how the resource system works and how to use them in your workflows
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* What is it */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                What is the Resources Registry?
              </h3>
              <p className="text-sm text-gray-700">
                The Resources Registry is Orchestrator AI's <strong>integration hub</strong>.
                Here you register connections to APIs, databases, messaging systems, and other
                data sources that will be used by your workflows and agents.
              </p>
            </div>

            {/* Resource Types */}
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-purple-600" />
                Available Resource Types
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">API HTTP</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    APIs REST, GraphQL, webhooks. Configure endpoint, método, headers e autenticação.
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-purple-900">Banco de Dados</span>
                  </div>
                  <p className="text-xs text-purple-700">
                    PostgreSQL, MySQL, MongoDB, Redis. Configure string de conexão e credenciais.
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-900">Arquivo/NFS</span>
                  </div>
                  <p className="text-xs text-green-700">
                    Sistemas de arquivo, S3, NFS. Leitura e escrita de arquivos estruturados.
                  </p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-orange-900">Mensageria</span>
                  </div>
                  <p className="text-xs text-orange-700">
                    Kafka, RabbitMQ, SQS. Produza e consuma eventos em filas e tópicos.
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-indigo-900">Webhook/Function</span>
                  </div>
                  <p className="text-xs text-indigo-700">
                    Funções serverless, webhooks customizados, integrações programáticas.
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Embedding Function</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    APIs de embedding (OpenAI, Cohere). Para vetorização de documentos na KB.
                  </p>
                </div>
              </div>
            </div>

            {/* Ambientes DEV/PRD */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-slate-600" />
                Ambientes e Promoção (DEV → PRD)
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Recursos são criados em <strong>DEV</strong> e podem ser promovidos para <strong>PRD</strong>
                após aprovação. Credenciais de PRD são isoladas e não são copiadas automaticamente.
              </p>
              <div className="flex gap-3 text-xs">
                <Badge className="bg-slate-200 text-slate-800">DEV - Desenvolvimento</Badge>
                <span className="text-gray-400">→</span>
                <Badge className="bg-green-600 text-white">PRD - Produção</Badge>
              </div>
            </div>

            {/* Como usar */}
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Workflow className="w-5 h-5 text-indigo-600" />
                Como Usar nos Workflows
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Cadastre o Recurso</p>
                    <p className="text-xs text-gray-600">
                      Clique em "Novo Recurso", escolha o tipo e configure endpoint, credenciais e metadados.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Teste a Conexão</p>
                    <p className="text-xs text-gray-600">
                      Use o botão "Testar" para verificar se as credenciais e endpoint estão corretos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Use no Workflow</p>
                    <p className="text-xs text-gray-600">
                      No editor de fluxo, use um nó <strong>HTTP Request</strong> ou <strong>Database Query</strong> e selecione o recurso cadastrado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Exemplo prático */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                Exemplo Prático
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Integrando uma API de clima para um agente de planejamento urbano:
              </p>
              <div className="bg-white p-3 rounded border border-emerald-200 text-xs font-mono">
                <p className="text-gray-500">// Cadastro do Recurso</p>
                <p><span className="text-purple-600">Nome:</span> "Weather API - OpenWeather"</p>
                <p><span className="text-purple-600">Tipo:</span> HTTP</p>
                <p><span className="text-purple-600">Endpoint:</span> https://api.openweathermap.org/data/2.5/weather</p>
                <p><span className="text-purple-600">Auth:</span> API_KEY (query param)</p>
                <p className="mt-2 text-gray-500">// No workflow, o nó HTTP Request busca dados</p>
                <p className="text-gray-500">// e passa para o agente tomar decisões</p>
              </div>
            </div>

            {/* Dicas */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-amber-600" />
                Dicas Importantes
              </h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Organize por Projeto:</strong> Associe recursos a projetos para melhor governança.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Use Subtipos:</strong> Classifique recursos (ex: "CRM", "ERP", "Analytics") para fácil localização.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Metadata:</strong> Documente o handler e script de integração no campo Metadata.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Sensibilidade:</strong> Marque recursos críticos para controle de acesso mais rigoroso.</span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsHelpDialogOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Resource Card Component
function ResourceCard({
  resource,
  onTest,
  onEdit,
  onDelete,
  onDuplicate,
  onPromote,
  onApprove,
  onReject,
  isTesting,
}: {
  resource: Resource
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPromote: () => void
  onApprove: () => void
  onReject: () => void
  isTesting: boolean
}) {
  const isDown = resource.health?.status === 'DOWN' || resource.health?.status === 'ERROR'
  const isUp = resource.health?.status === 'OK' || resource.health?.status === 'UP'
  const typeName = RESOURCE_TYPES.find(t => t.id === resource.type)?.name || resource.type

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title and Type */}
            <div>
              <h3 className="font-semibold text-base">
                {resource.name}
                {resource.env === 'PRD' && (
                  <span className="ml-2 text-xs text-muted-foreground">(PRD)</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{typeName}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded border font-medium',
                resource.env === 'DEV'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              )}>
                {resource.env}
              </span>
              {resource.subtype && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                  {resource.subtype}
                </span>
              )}
              {resource.sensitivity && (
                <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                  {resource.sensitivity}
                </span>
              )}
              {resource.promotionStatus === 'PENDING_APPROVAL' && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  Aguardando Aprovação
                </span>
              )}
              {resource.promotionStatus === 'APPROVED' && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                  Aprovado
                </span>
              )}
              {resource.tags?.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {tag}
                </span>
              ))}
            </div>

            {/* Endpoint */}
            {resource.endpoint && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                {resource.endpoint}
              </p>
            )}

            {/* Promotion/Approval Actions */}
            {resource.env === 'DEV' && resource.promotionStatus !== 'PENDING_APPROVAL' && (
              <div className="pt-3 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPromote}
                  className="w-full gap-2"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Promover para PRD
                </Button>
              </div>
            )}

            {resource.env === 'DEV' && resource.promotionStatus === 'PENDING_APPROVAL' && (
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={onApprove}
                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  className="w-full gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </Button>
              </div>
            )}

            {/* Status and Actions Row */}
            <div className="flex items-center justify-between pt-2">
              {/* Status */}
              <div className="flex items-center gap-4">
                {isDown && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Indisponível
                  </span>
                )}
                {isUp && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Disponível
                  </span>
                )}
                {resource.health?.checkedAt && (
                  <span className="text-xs text-muted-foreground">
                    Tested on {new Date(resource.health.checkedAt).toLocaleDateString('pt-BR')}, {new Date(resource.health.checkedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTest}
                  disabled={isTesting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Heart className="h-4 w-4 mr-1" />
                  )}
                  Health
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTest}
                  disabled={isTesting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Testar
                </Button>
                <span className="text-xs text-muted-foreground font-medium">
                  {resource.health?.status || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Edit/Duplicate/Delete Menu */}
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar">
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Form state interface (separate from API types to handle JSON strings)
interface ResourceFormData {
  name: string
  type: string
  subtype: string
  endpoint: string
  method: string
  env: 'DEV' | 'PRD' | 'QA' | 'HOMOLOG'
  isActive: boolean
  sensitivity: string
  visibility: string
  tags: string[]
  projectId: string
  // LLM fields
  llmProvider: string
  llmModel: string
  // Auth fields
  authMode: string
  apiKey: string
  apiKeyHeader: string
  apiKeyLocation: 'header' | 'query'
  bearerToken: string
  basicUsername: string
  basicPassword: string
  oauth2ClientId: string
  oauth2ClientSecret: string
  oauth2TokenUrl: string
  oauth2Scope: string
  jwtSecret: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  awsRegion: string
  awsService: string
  customHeaderName: string
  customHeaderValue: string
  // Slack fields
  slackBotToken: string
  slackSigningSecret: string
  slackAppToken: string
  slackDefaultChannel: string
  // Teams fields
  teamsTenantId: string
  teamsWebhookUrl: string
  teamsTeamId: string
  // Telegram fields
  telegramBotToken: string
  telegramDefaultChatId: string
  telegramParseMode: string
  telegramWebhookUrl: string
  // Vector Engine fields
  vectorProvider: string
  vectorIndexName: string
  vectorDimension: number
  vectorMetric: string
  vectorTopK: number
  vectorNamespace: string
  // Data Layer fields
  dataLayerType: string
  dataLayerSourceTable: string
  dataLayerFeatureColumns: string
  // JSON fields
  connectionJson: string
  configJson: string
  metadataJson: string
}

// Resource Form Component
function ResourceForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: Resource
  onSubmit: (data: CreateResourceRequest) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const queryClient = useQueryClient()

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.listProjects,
  })
  const projects = projectsData?.data || []

  // Test connection state
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    status?: string
    responseTime?: number
  } | null>(null)

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => resourceService.testResource(id),
    onSuccess: (data) => {
      setTestResult(data.data)
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast({
        title: data.data.success ? 'Teste concluído' : 'Falha no teste',
        description: data.data.message || 'Conexão testada.',
        variant: data.data.success ? 'default' : 'destructive',
      })
    },
    onError: (error: Error) => {
      setTestResult({ success: false, message: error.message })
      toast({
        title: 'Erro no teste',
        description: error.message || 'Não foi possível testar a conexão.',
        variant: 'destructive',
      })
    },
  })

  // Extract auth credentials and config from existing resource
  const existingAuth = initialData?.auth as Record<string, unknown> | undefined
  const existingConfig = initialData?.config as Record<string, unknown> | undefined
  const existingMetadata = initialData?.metadata as Record<string, unknown> | undefined

  const [formData, setFormData] = useState<ResourceFormData>({
    name: initialData?.name || '',
    type: initialData?.type || 'HTTP',
    subtype: initialData?.subtype || '',
    endpoint: initialData?.endpoint || '',
    method: initialData?.method || 'GET',
    env: initialData?.env || 'DEV',
    isActive: initialData?.isActive ?? true,
    sensitivity: initialData?.sensitivity || 'MEDIUM',
    visibility: initialData?.visibility || 'PROJECT_ONLY',
    tags: initialData?.tags || [],
    projectId: (initialData as unknown as { projectId?: string })?.projectId || '',
    // LLM fields
    llmProvider: (existingMetadata?.provider as string) || 'none',
    llmModel: (existingMetadata?.model as string) || '',
    // Auth fields
    authMode: (existingAuth?.mode as string) || 'NONE',
    apiKey: (existingAuth?.apiKey as string) || '',
    apiKeyHeader: (existingAuth?.headerName as string) || 'X-API-Key',
    apiKeyLocation: (existingAuth?.location as 'header' | 'query') || 'header',
    bearerToken: (existingAuth?.token as string) || '',
    basicUsername: (existingAuth?.username as string) || '',
    basicPassword: (existingAuth?.password as string) || '',
    oauth2ClientId: (existingAuth?.clientId as string) || '',
    oauth2ClientSecret: (existingAuth?.clientSecret as string) || '',
    oauth2TokenUrl: (existingAuth?.tokenUrl as string) || '',
    oauth2Scope: (existingAuth?.scope as string) || '',
    jwtSecret: (existingAuth?.secret as string) || '',
    awsAccessKeyId: (existingAuth?.accessKeyId as string) || '',
    awsSecretAccessKey: (existingAuth?.secretAccessKey as string) || '',
    awsRegion: (existingAuth?.region as string) || '',
    awsService: (existingAuth?.service as string) || '',
    customHeaderName: (existingAuth?.headerName as string) || '',
    customHeaderValue: (existingAuth?.headerValue as string) || '',
    // Slack fields
    slackBotToken: (existingAuth?.botToken as string) || '',
    slackSigningSecret: (existingAuth?.signingSecret as string) || '',
    slackAppToken: (existingAuth?.appToken as string) || '',
    slackDefaultChannel: (existingConfig?.defaultChannel as string) || '',
    // Teams fields
    teamsTenantId: (existingAuth?.tenantId as string) || '',
    teamsWebhookUrl: (existingConfig?.webhookUrl as string) || '',
    teamsTeamId: (existingConfig?.teamId as string) || '',
    // Telegram fields
    telegramBotToken: (existingAuth?.botToken as string) || '',
    telegramDefaultChatId: (existingConfig?.defaultChatId as string) || '',
    telegramParseMode: (existingConfig?.parseMode as string) || 'HTML',
    telegramWebhookUrl: (existingConfig?.webhookUrl as string) || '',
    // Vector Engine fields
    vectorProvider: (existingConfig?.provider as string) || 'pinecone',
    vectorIndexName: (existingConfig?.indexName as string) || '',
    vectorDimension: (existingConfig?.dimension as number) || 1536,
    vectorMetric: (existingConfig?.metric as string) || 'cosine',
    vectorTopK: (existingConfig?.topK as number) || 10,
    vectorNamespace: (existingConfig?.namespace as string) || '',
    // Data Layer fields
    dataLayerType: (existingConfig?.layerType as string) || 'feature_store',
    dataLayerSourceTable: (existingConfig?.sourceTable as string) || '',
    dataLayerFeatureColumns: (existingConfig?.featureColumns as string) || '',
    // JSON fields
    connectionJson: initialData?.connection ? JSON.stringify(initialData.connection, null, 2) : '{\n  "endpoint": ""\n}',
    configJson: initialData?.config ? JSON.stringify(initialData.config, null, 2) : '{}',
    metadataJson: initialData?.metadata ? JSON.stringify(initialData.metadata, null, 2) : '{}',
  })

  const copyId = () => {
    if (initialData?.id) {
      navigator.clipboard.writeText(initialData.id)
      toast({ title: 'Copiado', description: 'ID copiado para a área de transferência' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Parse JSON fields
    let connection: Record<string, unknown> = {}
    let config: Record<string, unknown> = {}
    let metadata: Record<string, unknown> = {}

    try {
      connection = JSON.parse(formData.connectionJson || '{}')
    } catch {
      toast({ title: 'Erro', description: 'Connection JSON inválido', variant: 'destructive' })
      return
    }

    try {
      config = JSON.parse(formData.configJson || '{}')
    } catch {
      toast({ title: 'Erro', description: 'Configuration JSON inválido', variant: 'destructive' })
      return
    }

    try {
      metadata = JSON.parse(formData.metadataJson || '{}')
    } catch {
      toast({ title: 'Erro', description: 'Metadata JSON inválido', variant: 'destructive' })
      return
    }

    // Build auth object based on authMode
    let auth: Record<string, unknown> | undefined = undefined
    if (formData.authMode !== 'NONE') {
      auth = { mode: formData.authMode }

      switch (formData.authMode) {
        case 'API_KEY':
          auth.apiKey = formData.apiKey
          auth.headerName = formData.apiKeyHeader
          auth.location = formData.apiKeyLocation
          break
        case 'BEARER':
          auth.token = formData.bearerToken
          break
        case 'BASIC':
          auth.username = formData.basicUsername
          auth.password = formData.basicPassword
          break
        case 'OAUTH2':
          auth.clientId = formData.oauth2ClientId
          auth.clientSecret = formData.oauth2ClientSecret
          auth.tokenUrl = formData.oauth2TokenUrl
          if (formData.oauth2Scope) {
            auth.scope = formData.oauth2Scope
          }
          break
        case 'JWT':
          auth.secret = formData.jwtSecret
          break
        case 'AWS':
          auth.accessKeyId = formData.awsAccessKeyId
          auth.secretAccessKey = formData.awsSecretAccessKey
          auth.region = formData.awsRegion
          auth.service = formData.awsService
          break
        case 'CUSTOM':
          auth.headerName = formData.customHeaderName
          auth.headerValue = formData.customHeaderValue
          break
      }
    }

    // Handle type-specific auth and config
    if (formData.type === 'SLACK') {
      auth = {
        mode: 'BEARER',
        botToken: formData.slackBotToken,
        signingSecret: formData.slackSigningSecret,
        appToken: formData.slackAppToken,
      }
      config = { ...config, defaultChannel: formData.slackDefaultChannel }
    }

    if (formData.type === 'TEAMS') {
      auth = {
        mode: 'OAUTH2',
        tenantId: formData.teamsTenantId,
        clientId: formData.oauth2ClientId,
        clientSecret: formData.oauth2ClientSecret,
      }
      config = { ...config, webhookUrl: formData.teamsWebhookUrl, teamId: formData.teamsTeamId }
    }

    if (formData.type === 'TELEGRAM') {
      auth = {
        mode: 'BEARER',
        botToken: formData.telegramBotToken,
      }
      config = {
        ...config,
        defaultChatId: formData.telegramDefaultChatId,
        parseMode: formData.telegramParseMode,
        webhookUrl: formData.telegramWebhookUrl,
      }
    }

    if (formData.type === 'VECTOR_ENGINE') {
      config = {
        ...config,
        provider: formData.vectorProvider,
        indexName: formData.vectorIndexName,
        dimension: formData.vectorDimension,
        metric: formData.vectorMetric,
        topK: formData.vectorTopK,
        namespace: formData.vectorNamespace,
      }
    }

    if (formData.type === 'DATA_LAYER') {
      config = {
        ...config,
        layerType: formData.dataLayerType,
        sourceTable: formData.dataLayerSourceTable,
        featureColumns: formData.dataLayerFeatureColumns,
      }
    }

    // Add LLM provider/model to metadata if set
    if (formData.llmProvider && formData.llmProvider !== 'none') {
      metadata = {
        ...metadata,
        provider: formData.llmProvider,
        model: formData.llmModel,
      }
    }

    onSubmit({
      name: formData.name,
      type: formData.type,
      subtype: formData.subtype,
      endpoint: formData.endpoint,
      method: formData.method,
      env: formData.env,
      isActive: formData.isActive,
      sensitivity: formData.sensitivity,
      visibility: formData.visibility,
      tags: formData.tags,
      projectId: formData.projectId || undefined,
      connection,
      config,
      metadata,
      auth,
    } as CreateResourceRequest)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Resource' : 'Novo Resource'}</DialogTitle>
        <DialogDescription>
          {initialData
            ? 'Atualize a configuração do resource'
            : 'Adicione um novo resource ao registro'}
        </DialogDescription>
      </DialogHeader>

      {/* Resource ID */}
      {initialData && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Resource ID:</span>
          <code className="text-sm font-mono flex-1">{initialData.id}</code>
          <Button type="button" variant="ghost" size="sm" onClick={copyId}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Resource Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nome do resource"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtype">Subtipo</Label>
        <Input
          id="subtype"
          value={formData.subtype}
          onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
          placeholder="Ex: PostgreSQL, WhatsApp, OpenAI"
        />
      </div>

      {/* LLM Provider/Model Configuration - Only for HTTP type */}
      {formData.type === 'HTTP' && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg space-y-4">
          <h5 className="font-medium text-purple-800 text-sm flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Configuração LLM (opcional)
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="llmProvider">Provedor</Label>
              <select
                id="llmProvider"
                value={formData.llmProvider}
                onChange={(e) => {
                  const provider = e.target.value
                  const models = LLM_PROVIDERS[provider]?.models || []
                  setFormData({
                    ...formData,
                    llmProvider: provider,
                    llmModel: models.length > 0 ? models[0].value : ''
                  })
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.label}</option>
                ))}
              </select>
            </div>
            {formData.llmProvider && formData.llmProvider !== 'none' && LLM_PROVIDERS[formData.llmProvider]?.models?.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="llmModel">Modelo</Label>
                <select
                  id="llmModel"
                  value={formData.llmModel}
                  onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {LLM_PROVIDERS[formData.llmProvider].models.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
            )}
            {formData.llmProvider === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="llmModel">Nome do Modelo</Label>
                <Input
                  id="llmModel"
                  value={formData.llmModel}
                  onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                  placeholder="Digite o nome do modelo"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Configure se este recurso for uma API de LLM. O provedor e modelo serão usados automaticamente em Agents e Assistants.
          </p>
        </div>
      )}

      {/* Endpoint */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="endpoint">Endpoint/URL</Label>
          <Input
            id="endpoint"
            value={formData.endpoint}
            onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
            placeholder="http://example.com:8000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Método HTTP</Label>
          <select
            id="method"
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Método HTTP usado para testar a conexão com o recurso</p>
        </div>
      </div>

      {/* Project */}
      <div className="space-y-2">
        <Label htmlFor="projectId">Projeto</Label>
        <select
          id="projectId"
          value={formData.projectId}
          onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sem projeto</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Associe este recurso a um projeto para melhor organização</p>
      </div>

      {/* Governance Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Governança e Segurança</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="env">Ambiente</Label>
            <select
              id="env"
              value={formData.env}
              onChange={(e) => setFormData({ ...formData, env: e.target.value as 'DEV' | 'PRD' | 'QA' | 'HOMOLOG' })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DEV">Development</option>
              <option value="PRD">Production</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sensitivity">Sensibilidade</Label>
            <select
              id="sensitivity"
              value={formData.sensitivity}
              onChange={(e) => setFormData({ ...formData, sensitivity: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SENSITIVITY_LEVELS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Nível de sensibilidade dos dados</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibilidade</Label>
            <select
              id="visibility"
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Quem pode visualizar este recurso</p>
          </div>
        </div>
      </div>

      {/* Auth Mode */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="authMode">Modo de Autenticação</Label>
          <select
            id="authMode"
            value={formData.authMode}
            onChange={(e) => setFormData({ ...formData, authMode: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {AUTH_MODES.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Dynamic Auth Fields based on authMode */}
        {formData.authMode === 'API_KEY' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <h5 className="font-medium text-blue-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração API Key
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sua-api-key-aqui"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKeyHeader">Nome do Header</Label>
                <Input
                  id="apiKeyHeader"
                  value={formData.apiKeyHeader}
                  onChange={(e) => setFormData({ ...formData, apiKeyHeader: e.target.value })}
                  placeholder="X-API-Key"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKeyLocation">Localização</Label>
              <select
                id="apiKeyLocation"
                value={formData.apiKeyLocation}
                onChange={(e) => setFormData({ ...formData, apiKeyLocation: e.target.value as 'header' | 'query' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Onde a API Key será enviada nas requisições
              </p>
            </div>
          </div>
        )}

        {formData.authMode === 'BEARER' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
            <h5 className="font-medium text-green-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração Bearer Token
            </h5>
            <div className="space-y-2">
              <Label htmlFor="bearerToken">Bearer Token</Label>
              <Input
                id="bearerToken"
                type="password"
                value={formData.bearerToken}
                onChange={(e) => setFormData({ ...formData, bearerToken: e.target.value })}
                placeholder="seu-token-aqui"
              />
              <p className="text-xs text-muted-foreground">
                Token será enviado como: Authorization: Bearer &lt;token&gt;
              </p>
            </div>
          </div>
        )}

        {formData.authMode === 'BASIC' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
            <h5 className="font-medium text-amber-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração Basic Auth
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="basicUsername">Usuário</Label>
                <Input
                  id="basicUsername"
                  value={formData.basicUsername}
                  onChange={(e) => setFormData({ ...formData, basicUsername: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basicPassword">Senha</Label>
                <Input
                  id="basicPassword"
                  type="password"
                  value={formData.basicPassword}
                  onChange={(e) => setFormData({ ...formData, basicPassword: e.target.value })}
                  placeholder="password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Credenciais serão codificadas em Base64 e enviadas no header Authorization
            </p>
          </div>
        )}

        {formData.authMode === 'OAUTH2' && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
            <h5 className="font-medium text-purple-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração OAuth 2.0
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oauth2ClientId">Client ID</Label>
                <Input
                  id="oauth2ClientId"
                  value={formData.oauth2ClientId}
                  onChange={(e) => setFormData({ ...formData, oauth2ClientId: e.target.value })}
                  placeholder="client-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oauth2ClientSecret">Client Secret</Label>
                <Input
                  id="oauth2ClientSecret"
                  type="password"
                  value={formData.oauth2ClientSecret}
                  onChange={(e) => setFormData({ ...formData, oauth2ClientSecret: e.target.value })}
                  placeholder="client-secret"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth2TokenUrl">Token URL</Label>
              <Input
                id="oauth2TokenUrl"
                value={formData.oauth2TokenUrl}
                onChange={(e) => setFormData({ ...formData, oauth2TokenUrl: e.target.value })}
                placeholder="https://auth.example.com/oauth/token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth2Scope">Scope (opcional)</Label>
              <Input
                id="oauth2Scope"
                value={formData.oauth2Scope}
                onChange={(e) => setFormData({ ...formData, oauth2Scope: e.target.value })}
                placeholder="read write"
              />
              <p className="text-xs text-muted-foreground">
                Escopos separados por espaço
              </p>
            </div>
          </div>
        )}

        {formData.authMode === 'CUSTOM' && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
            <h5 className="font-medium text-slate-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração Custom Header
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customHeaderName">Nome do Header</Label>
                <Input
                  id="customHeaderName"
                  value={formData.customHeaderName}
                  onChange={(e) => setFormData({ ...formData, customHeaderName: e.target.value })}
                  placeholder="X-Custom-Auth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customHeaderValue">Valor do Header</Label>
                <Input
                  id="customHeaderValue"
                  type="password"
                  value={formData.customHeaderValue}
                  onChange={(e) => setFormData({ ...formData, customHeaderValue: e.target.value })}
                  placeholder="valor-do-header"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Header customizado será enviado em todas as requisições
            </p>
          </div>
        )}

        {formData.authMode === 'JWT' && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-4">
            <h5 className="font-medium text-indigo-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração JWT
            </h5>
            <div className="space-y-2">
              <Label htmlFor="jwtSecret">JWT Secret</Label>
              <Input
                id="jwtSecret"
                type="password"
                value={formData.jwtSecret}
                onChange={(e) => setFormData({ ...formData, jwtSecret: e.target.value })}
                placeholder="your-secret-key"
              />
              <p className="text-xs text-muted-foreground">
                Secret usado para assinar/verificar tokens JWT
              </p>
            </div>
          </div>
        )}

        {formData.authMode === 'AWS' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4">
            <h5 className="font-medium text-orange-900 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Configuração AWS Signature
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="awsAccessKeyId">Access Key ID</Label>
                <Input
                  id="awsAccessKeyId"
                  value={formData.awsAccessKeyId}
                  onChange={(e) => setFormData({ ...formData, awsAccessKeyId: e.target.value })}
                  placeholder="AKIA..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awsSecretAccessKey">Secret Access Key</Label>
                <Input
                  id="awsSecretAccessKey"
                  type="password"
                  value={formData.awsSecretAccessKey}
                  onChange={(e) => setFormData({ ...formData, awsSecretAccessKey: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awsRegion">Região</Label>
                <Input
                  id="awsRegion"
                  value={formData.awsRegion}
                  onChange={(e) => setFormData({ ...formData, awsRegion: e.target.value })}
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awsService">Serviço</Label>
                <Input
                  id="awsService"
                  value={formData.awsService}
                  onChange={(e) => setFormData({ ...formData, awsService: e.target.value })}
                  placeholder="s3"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slack Configuration */}
      {formData.type === 'SLACK' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
          <h5 className="font-medium text-purple-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Configuração do Slack
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slackBotToken">Bot Token (xoxb-...)</Label>
              <Input
                id="slackBotToken"
                type="password"
                value={formData.slackBotToken}
                onChange={(e) => setFormData({ ...formData, slackBotToken: e.target.value })}
                placeholder="xoxb-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Token do Bot obtido no Slack App</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackSigningSecret">Signing Secret</Label>
              <Input
                id="slackSigningSecret"
                type="password"
                value={formData.slackSigningSecret}
                onChange={(e) => setFormData({ ...formData, slackSigningSecret: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Para verificar requests do Slack</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackAppToken">App-Level Token (xapp-...)</Label>
              <Input
                id="slackAppToken"
                type="password"
                value={formData.slackAppToken}
                onChange={(e) => setFormData({ ...formData, slackAppToken: e.target.value })}
                placeholder="xapp-x-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Para Socket Mode (eventos em tempo real)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackDefaultChannel">Canal Padrão</Label>
              <Input
                id="slackDefaultChannel"
                value={formData.slackDefaultChannel}
                onChange={(e) => setFormData({ ...formData, slackDefaultChannel: e.target.value })}
                placeholder="#geral ou C0123456789"
              />
              <p className="text-xs text-muted-foreground">Canal para enviar mensagens por padrão</p>
            </div>
          </div>
        </div>
      )}

      {/* Teams Configuration */}
      {formData.type === 'TEAMS' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          <h5 className="font-medium text-blue-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Configuração do Microsoft Teams
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamsTenantId">Tenant ID</Label>
              <Input
                id="teamsTenantId"
                value={formData.teamsTenantId}
                onChange={(e) => setFormData({ ...formData, teamsTenantId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">ID do tenant do Azure AD</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth2ClientId">Client ID (App ID)</Label>
              <Input
                id="oauth2ClientId"
                value={formData.oauth2ClientId}
                onChange={(e) => setFormData({ ...formData, oauth2ClientId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">ID do App registrado no Azure</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth2ClientSecret">Client Secret</Label>
              <Input
                id="oauth2ClientSecret"
                type="password"
                value={formData.oauth2ClientSecret}
                onChange={(e) => setFormData({ ...formData, oauth2ClientSecret: e.target.value })}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">Secret do App Azure AD</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamsWebhookUrl">Webhook URL</Label>
              <Input
                id="teamsWebhookUrl"
                value={formData.teamsWebhookUrl}
                onChange={(e) => setFormData({ ...formData, teamsWebhookUrl: e.target.value })}
                placeholder="https://outlook.office.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">Incoming Webhook para enviar mensagens</p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="teamsTeamId">Team ID</Label>
              <Input
                id="teamsTeamId"
                value={formData.teamsTeamId}
                onChange={(e) => setFormData({ ...formData, teamsTeamId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">ID do Team padrão para operações</p>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Configuration */}
      {formData.type === 'TELEGRAM' && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg space-y-4">
          <h5 className="font-medium text-sky-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Configuração do Telegram
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="telegramBotToken">Bot Token</Label>
              <Input
                id="telegramBotToken"
                type="password"
                value={formData.telegramBotToken}
                onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              <p className="text-xs text-muted-foreground">Token obtido do @BotFather</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegramDefaultChatId">Chat ID Padrão</Label>
              <Input
                id="telegramDefaultChatId"
                value={formData.telegramDefaultChatId}
                onChange={(e) => setFormData({ ...formData, telegramDefaultChatId: e.target.value })}
                placeholder="-1001234567890"
              />
              <p className="text-xs text-muted-foreground">ID do chat/grupo para mensagens padrão</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegramParseMode">Parse Mode</Label>
              <select
                id="telegramParseMode"
                value={formData.telegramParseMode}
                onChange={(e) => setFormData({ ...formData, telegramParseMode: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="HTML">HTML</option>
                <option value="Markdown">Markdown</option>
                <option value="MarkdownV2">MarkdownV2</option>
              </select>
              <p className="text-xs text-muted-foreground">Formato de texto das mensagens</p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="telegramWebhookUrl">Webhook URL</Label>
              <Input
                id="telegramWebhookUrl"
                value={formData.telegramWebhookUrl}
                onChange={(e) => setFormData({ ...formData, telegramWebhookUrl: e.target.value })}
                placeholder="https://seu-dominio.com/api/telegram/webhook"
              />
              <p className="text-xs text-muted-foreground">URL para receber updates via webhook</p>
            </div>
          </div>
        </div>
      )}

      {/* Vector Engine Configuration */}
      {formData.type === 'VECTOR_ENGINE' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-4">
          <h5 className="font-medium text-rose-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Configuração Vector Engine
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vectorProvider">Provider</Label>
              <select
                id="vectorProvider"
                value={formData.vectorProvider}
                onChange={(e) => setFormData({ ...formData, vectorProvider: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {VECTOR_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Vector database provider</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vectorIndexName">Index/Collection Name</Label>
              <Input
                id="vectorIndexName"
                value={formData.vectorIndexName}
                onChange={(e) => setFormData({ ...formData, vectorIndexName: e.target.value })}
                placeholder="my-vector-index"
              />
              <p className="text-xs text-muted-foreground">Name of the vector index or collection</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vectorDimension">Dimension</Label>
              <Input
                id="vectorDimension"
                type="number"
                value={formData.vectorDimension}
                onChange={(e) => setFormData({ ...formData, vectorDimension: parseInt(e.target.value) || 1536 })}
                placeholder="1536"
              />
              <p className="text-xs text-muted-foreground">OpenAI: 1536, Cohere: 1024</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vectorMetric">Metric</Label>
              <select
                id="vectorMetric"
                value={formData.vectorMetric}
                onChange={(e) => setFormData({ ...formData, vectorMetric: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="cosine">Cosine Similarity</option>
                <option value="euclidean">Euclidean Distance</option>
                <option value="dotproduct">Dot Product</option>
              </select>
              <p className="text-xs text-muted-foreground">Similarity metric</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vectorTopK">Top K (default)</Label>
              <Input
                id="vectorTopK"
                type="number"
                value={formData.vectorTopK}
                onChange={(e) => setFormData({ ...formData, vectorTopK: parseInt(e.target.value) || 10 })}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">Default results to return</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vectorNamespace">Namespace/Partition</Label>
              <Input
                id="vectorNamespace"
                value={formData.vectorNamespace}
                onChange={(e) => setFormData({ ...formData, vectorNamespace: e.target.value })}
                placeholder="default"
              />
              <p className="text-xs text-muted-foreground">Logical partition for multi-tenant scenarios</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Layer Configuration */}
      {formData.type === 'DATA_LAYER' && (
        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-4">
          <h5 className="font-medium text-cyan-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Configuração Data Layer
          </h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataLayerType">Layer Type</Label>
              <select
                id="dataLayerType"
                value={formData.dataLayerType}
                onChange={(e) => setFormData({ ...formData, dataLayerType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DATA_LAYER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Type of data layer</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataLayerSourceTable">Source Table/View</Label>
              <Input
                id="dataLayerSourceTable"
                value={formData.dataLayerSourceTable}
                onChange={(e) => setFormData({ ...formData, dataLayerSourceTable: e.target.value })}
                placeholder="analytics.feature_vectors"
              />
              <p className="text-xs text-muted-foreground">Source table for feature extraction</p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="dataLayerFeatureColumns">Feature Columns (comma-separated)</Label>
              <Input
                id="dataLayerFeatureColumns"
                value={formData.dataLayerFeatureColumns}
                onChange={(e) => setFormData({ ...formData, dataLayerFeatureColumns: e.target.value })}
                placeholder="feature1, feature2, feature3"
              />
              <p className="text-xs text-muted-foreground">Columns to extract as features</p>
            </div>
          </div>
        </div>
      )}

      {/* JSON Editors */}
      <div className="space-y-2">
        <Label htmlFor="connectionJson">Connection (JSON)</Label>
        <textarea
          id="connectionJson"
          value={formData.connectionJson}
          onChange={(e) => setFormData({ ...formData, connectionJson: e.target.value })}
          className="flex min-h-[120px] w-full rounded-md border border-input bg-zinc-900 text-zinc-100 px-3 py-2 text-sm font-mono"
          placeholder='{"endpoint": ""}'
        />
        <p className="text-xs text-muted-foreground">
          Informe host/porta/usuário/senha/database ou uma connectionString.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="configJson">Configuration (JSON)</Label>
          <textarea
            id="configJson"
            value={formData.configJson}
            onChange={(e) => setFormData({ ...formData, configJson: e.target.value })}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-zinc-900 text-zinc-100 px-3 py-2 text-sm font-mono"
            placeholder='{}'
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="metadataJson">Metadata (JSON)</Label>
          <textarea
            id="metadataJson"
            value={formData.metadataJson}
            onChange={(e) => setFormData({ ...formData, metadataJson: e.target.value })}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-zinc-900 text-zinc-100 px-3 py-2 text-sm font-mono"
            placeholder='{}'
          />
        </div>
      </div>

      {/* Test Connection Section - Only shown when editing */}
      {initialData?.id && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-gray-900">Testar Conexão</h4>
              <p className="text-sm text-muted-foreground">Verifique se o recurso está acessível</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate(initialData.id)}
              disabled={testMutation.isPending}
              className="gap-2"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  Testar Agora
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div
              className={cn(
                "p-4 rounded-lg border",
                testResult.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h5
                    className={cn(
                      "font-semibold mb-1",
                      testResult.success ? "text-green-900" : "text-red-900"
                    )}
                  >
                    {testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
                  </h5>
                  <p
                    className={cn(
                      "text-sm",
                      testResult.success ? "text-green-700" : "text-red-700"
                    )}
                  >
                    {testResult.message || "Teste concluído"}
                  </p>
                  {testResult.responseTime && (
                    <p className="text-xs text-gray-600 mt-2">
                      Tempo de resposta: {testResult.responseTime}ms
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? 'Atualizar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
