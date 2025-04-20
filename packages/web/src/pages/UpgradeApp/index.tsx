import { CircleX } from 'lucide-react'

export const UpgradeApp = () => (
  <div className="nekoil-result-container">
    <CircleX className="nekoil-result-icon" />
    <p className="nekoil-result-title">需要更新 APP</p>
    <p className="nekoil-result-content">
      Nekoil 未能正确初始化。最常见的原因是网络问题和 APP 版本过低，尝试升级 APP
      以解决此问题。
    </p>
  </div>
)
