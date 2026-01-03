import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listResources } from '@/services/resource.service'
import { listApiKeys } from '@/services/api-key.service'
import {
  Database,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Activity,
  Globe,
  Shield,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => listResources(),
  })

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => listApiKeys(),
  })

  const resources = resourcesData?.data || []
  const apiKeys = apiKeysData?.data || []

  const activeResources = resources.filter(r => r.isActive)
  const healthyResources = resources.filter(r => r.health?.status === 'OK' || r.health?.status === 'UP')
  const unhealthyResources = resources.filter(r => r.health?.status === 'DOWN' || r.health?.status === 'ERROR')
  const devResources = resources.filter(r => r.env === 'DEV')
  const prdResources = resources.filter(r => r.env === 'PRD')

  const activeApiKeys = apiKeys.filter(k => k.isActive)

  // Summary cards for the header
  const summaryCards = [
    {
      id: 'resources',
      label: 'TOTAL RESOURCES',
      value: resourcesLoading ? '-' : resources.length,
      sublabel: `${activeResources.length} active`,
      icon: Database,
    },
    {
      id: 'apikeys',
      label: 'API KEYS',
      value: apiKeysLoading ? '-' : apiKeys.length,
      sublabel: `${activeApiKeys.length} active`,
      icon: Key,
    },
    {
      id: 'healthy',
      label: 'HEALTHY',
      value: resourcesLoading ? '-' : healthyResources.length,
      sublabel: 'resources online',
      icon: CheckCircle,
    },
    {
      id: 'unhealthy',
      label: 'UNHEALTHY',
      value: resourcesLoading ? '-' : unhealthyResources.length,
      sublabel: 'resources down',
      icon: XCircle,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Gradient Header */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 text-white px-6 py-7 md:px-10 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/70 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              KeyVault Registry
            </p>
            <h1 className="text-3xl font-semibold leading-tight">Dashboard</h1>
            <p className="text-sm text-white/80 mt-3 max-w-3xl">
              Overview of your resources, API keys, and system health. Monitor integrations and access control from a single view.
            </p>
          </div>
        </div>
        {/* Stats Cards Inside Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
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

      {/* Info Card */}
      <Card className="p-6 border-none shadow-lg bg-gradient-to-r from-slate-50 to-indigo-50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">KeyVault Registry (KVR)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Gerencie recursos de integração e chaves de API para seus workflows. Centralize credenciais,
              monitore saúde das conexões e controle acesso via API Keys com escopos granulares.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Globe className="w-3 h-3 mr-1" />
                Resources
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Key className="w-3 h-3 mr-1" />
                API Keys
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Shield className="w-3 h-3 mr-1" />
                Access Control
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Activity className="w-3 h-3 mr-1" />
                Health Check
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Environment Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment Distribution</CardTitle>
            <CardDescription>Resources by environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">Development (DEV)</span>
                </div>
                <span className="font-medium">{devResources.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">Production (PRD)</span>
                </div>
                <span className="font-medium">{prdResources.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Types</CardTitle>
            <CardDescription>Resources by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(
                resources.reduce((acc: Record<string, number>, r) => {
                  acc[r.type] = (acc[r.type] || 0) + 1
                  return acc
                }, {})
              ).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{type}</span>
                  <span className="font-medium">{count as number}</span>
                </div>
              ))}
              {resources.length === 0 && (
                <p className="text-sm text-muted-foreground">No resources yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Resources */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Resources</CardTitle>
            <CardDescription>Latest added resources</CardDescription>
          </div>
          <Link
            to="/resources"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resources.slice(0, 5).map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    resource.health?.status === 'OK' || resource.health?.status === 'UP' ? 'bg-green-500' :
                    resource.health?.status === 'DOWN' || resource.health?.status === 'ERROR' ? 'bg-red-500' :
                    'bg-gray-300'
                  )} />
                  <div>
                    <p className="text-sm font-medium">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {resource.type} | {resource.env}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  resource.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                )}>
                  {resource.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
            {resources.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No resources yet</p>
                <Link
                  to="/resources"
                  className="text-sm text-primary hover:underline"
                >
                  Add your first resource
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
