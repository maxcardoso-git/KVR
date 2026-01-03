import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function TahCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setTahToken } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setErrorMessage(error)
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    if (!token) {
      setStatus('error')
      setErrorMessage('Token não encontrado na URL')
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    // Set the TAH token and authenticate
    const authenticate = async () => {
      try {
        await setTahToken(token)
        setStatus('success')
        setTimeout(() => navigate('/'), 1000)
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Falha na autenticação')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    authenticate()
  }, [searchParams, navigate, setTahToken])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Autenticando...
            </h2>
            <p className="text-gray-600">
              Validando credenciais do TAH
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Login realizado!
            </h2>
            <p className="text-gray-600">
              Redirecionando para o dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erro na autenticação
            </h2>
            <p className="text-gray-600 mb-4">
              {errorMessage}
            </p>
            <p className="text-sm text-gray-500">
              Redirecionando para login...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
