import { CircleX } from 'lucide-react'
import { NekoilApiError } from '../../utils/request'

export const ResultError = ({ e }: { e: Error }) => (
  <div className="nekoil-result-container">
    <CircleX className="nekoil-result-icon" />
    <p className="nekoil-result-title">
      错误 {e instanceof NekoilApiError ? e.code : ''}
    </p>
    <p className="nekoil-result-content">{e.message}</p>
  </div>
)
