import { CircleX } from 'lucide-react'

export const Banned = () => (
  <div className="nekoil-result-container">
    <CircleX className="nekoil-result-icon" />
    <p className="nekoil-result-title">没有访问权限（错误 2001）</p>
    <p className="nekoil-result-content">没有 Nekoil 的访问权限。</p>
  </div>
)
