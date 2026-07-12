/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useEffect, useState, type ReactElement } from 'react'
import { subscribeAdminNavigated } from '../spa-nav/admin-spa-nav'
import { BrandHeader, BuildVersionFooter, OperatorBar, SearchTrigger } from './admin-sidebar-chrome'
import { useBuildVersionOnly, useOperator, useVersion } from './admin-sidebar-data'
import { DataNavList, DeveloperNavList, OverviewNavLink } from './admin-sidebar-data-tabs'

interface AdminSidebarIslandProps {
  readonly canEdit?: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot?: Readonly<Record<string, unknown>>
  readonly collapsed?: boolean
}

function activePath(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname.replace(/^\/_admin/, '') || '/'
}

function useActivePath(): string {
  const [path, setPath] = useState<string>(() => activePath())
  useEffect(() => {
    setPath(activePath())
    return subscribeAdminNavigated(setPath)
  }, [])
  return path
}

export default function AdminSidebarIsland({
  appName,
  appVersion,
}: AdminSidebarIslandProps): ReactElement {
  const path = useActivePath()
  const operator = useOperator()
  const version = useVersion(appVersion)
  const buildVersion = useBuildVersionOnly()

  return (
    <div
      data-dashboard-sidebar
      className="flex h-full flex-col gap-5"
    >
      <BrandHeader
        appName={appName}
        version={version}
      />
      <SearchTrigger />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {}
        <OverviewNavLink activePath={path} />
        <DataNavList activePath={path} />
        {}
        <DeveloperNavList activePath={path} />
      </div>
      <div className="flex flex-col gap-2">
        <OperatorBar operator={operator} />
        <BuildVersionFooter buildVersion={buildVersion} />
      </div>
    </div>
  )
}
