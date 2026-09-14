"use client"

import { useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function OrganizationBadge() {
  const [slug, setSlug] = useState("")

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data } = await supabase.from("college_admins").select("colleges(slug)").eq("user_id", auth.user.id).maybeSingle()
      const row = data as { colleges?: { slug?: string } | null } | null
      if (row?.colleges?.slug) setSlug(row.colleges.slug)
    }
    void load()
  }, [])

  if (!slug) return null
  return <span title={`Organization: ${slug}`} className="flex max-w-[130px] items-center gap-1.5 truncate rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{slug}</span></span>
}
