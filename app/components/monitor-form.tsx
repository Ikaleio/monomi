import { useState, type FormEvent } from "react"

import { monitorInputSchema, type MonitorInput } from "../../shared/contracts"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"

const defaultHttp: MonitorInput = {
  type: "http",
  name: "",
  description: "",
  intervalSeconds: 60,
  timeoutMs: 10000,
  failureThreshold: 2,
  latencyThresholdMs: null,
  enabled: true,
  url: "",
  method: "GET",
  headers: {},
  body: null,
  expectedStatusMin: 200,
  expectedStatusMax: 299,
  keyword: null,
  followRedirects: true,
  validateTls: true,
}
const defaultTcp: MonitorInput = {
  type: "tcp",
  name: "",
  description: "",
  intervalSeconds: 60,
  timeoutMs: 10000,
  failureThreshold: 2,
  latencyThresholdMs: null,
  enabled: true,
  host: "",
  port: 443,
}
const defaultHeartbeat: MonitorInput = {
  type: "heartbeat",
  name: "",
  description: "",
  intervalSeconds: 60,
  timeoutMs: 10000,
  failureThreshold: 2,
  latencyThresholdMs: null,
  enabled: true,
  graceSeconds: 60,
}

function numberValue(value: string) {
  return Number(value)
}

export function MonitorForm({
  initial,
  pending = false,
  submitLabel = "保存监视器",
  onSubmit,
}: {
  initial?: MonitorInput
  pending?: boolean
  submitLabel?: string
  onSubmit(input: MonitorInput): Promise<void>
}) {
  const [form, setForm] = useState<MonitorInput>(initial ?? defaultHttp)
  const [error, setError] = useState<string | null>(null)
  const setField = (key: string, value: unknown) =>
    setForm((previous) => ({ ...previous, [key]: value }) as MonitorInput)
  const replaceType = (type: string) =>
    setForm(
      type === "tcp"
        ? { ...defaultTcp, name: form.name, description: form.description }
        : type === "heartbeat"
          ? {
              ...defaultHeartbeat,
              name: form.name,
              description: form.description,
            }
          : { ...defaultHttp, name: form.name, description: form.description }
    )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = monitorInputSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "请检查表单")
      return
    }
    setError(null)
    try {
      await onSubmit(parsed.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败")
    }
  }

  const headers = form.type === "http" ? Object.entries(form.headers) : []
  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-4 md:gap-5">
      <FieldGroup>
        {error && (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="name">名称</FieldLabel>
          <Input
            id="name"
            value={form.name}
            maxLength={80}
            required
            onChange={(event) => setField("name", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">描述</FieldLabel>
          <Textarea
            id="description"
            value={form.description}
            maxLength={240}
            onChange={(event) => setField("description", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>监视器类型</FieldLabel>
          <ToggleGroup
            type="single"
            value={form.type}
            onValueChange={(value) => value && replaceType(value)}
            className="justify-start"
          >
            <ToggleGroupItem value="http">HTTP / HTTPS</ToggleGroupItem>
            <ToggleGroupItem value="tcp">TCP</ToggleGroupItem>
            <ToggleGroupItem value="heartbeat">Heartbeat</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {form.type === "http" && (
          <>
            <Field>
              <FieldLabel htmlFor="url">目标 URL</FieldLabel>
              <Input
                id="url"
                type="url"
                value={form.url}
                maxLength={2048}
                placeholder="https://example.com/health"
                required
                onChange={(event) => setField("url", event.target.value)}
              />
              <FieldDescription>支持公开服务和可信内网地址。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="method">请求方法</FieldLabel>
              <Select
                value={form.method}
                onValueChange={(value) => setField("method", value)}
              >
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="HEAD">HEAD</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="body">请求 Body（可选）</FieldLabel>
              <Textarea
                id="body"
                value={form.body ?? ""}
                maxLength={65536}
                onChange={(event) =>
                  setField("body", event.target.value || null)
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="keyword">响应关键字（可选）</FieldLabel>
              <Input
                id="keyword"
                value={form.keyword ?? ""}
                maxLength={256}
                onChange={(event) =>
                  setField("keyword", event.target.value || null)
                }
              />
            </Field>
            <Field>
              <FieldLabel>自定义 Header</FieldLabel>
              <div className="flex flex-col gap-3">
                {headers.map(([key, value], index) => (
                  <div
                    className="flex items-center gap-2"
                    key={`${key}-${index}`}
                  >
                    <Input
                      aria-label={`Header ${index + 1} 名称`}
                      value={key}
                      onChange={(event) => {
                        const next = { ...form.headers }
                        delete next[key]
                        next[event.target.value] = value
                        setField("headers", next)
                      }}
                    />
                    <Input
                      aria-label={`Header ${index + 1} 值`}
                      value={value}
                      onChange={(event) =>
                        setField("headers", {
                          ...form.headers,
                          [key]: event.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = { ...form.headers }
                        delete next[key]
                        setField("headers", next)
                      }}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setField("headers", { ...form.headers, "": "" })
                  }
                >
                  添加 Header
                </Button>
              </div>
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="followRedirects"
                checked={form.followRedirects}
                onCheckedChange={(value) => setField("followRedirects", value)}
              />
              <FieldLabel htmlFor="followRedirects">
                跟随最多五次重定向
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="validateTls"
                checked={form.validateTls}
                onCheckedChange={(value) => setField("validateTls", value)}
              />
              <FieldLabel htmlFor="validateTls">校验证书</FieldLabel>
            </Field>
          </>
        )}
        {form.type === "tcp" && (
          <>
            <Field>
              <FieldLabel htmlFor="host">主机</FieldLabel>
              <Input
                id="host"
                value={form.host}
                maxLength={253}
                required
                onChange={(event) => setField("host", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="port">端口</FieldLabel>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                required
                onChange={(event) =>
                  setField("port", numberValue(event.target.value))
                }
              />
            </Field>
          </>
        )}
        {form.type === "heartbeat" && (
          <Field>
            <FieldLabel htmlFor="graceSeconds">宽限时间（秒）</FieldLabel>
            <Input
              id="graceSeconds"
              type="number"
              min={0}
              max={86400}
              value={form.graceSeconds}
              required
              onChange={(event) =>
                setField("graceSeconds", numberValue(event.target.value))
              }
            />
            <FieldDescription>
              超过间隔与宽限时间仍未收到信号时标记中断。
            </FieldDescription>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="intervalSeconds">检测间隔（秒）</FieldLabel>
            <Input
              id="intervalSeconds"
              type="number"
              min={30}
              max={3600}
              value={form.intervalSeconds}
              onChange={(event) =>
                setField("intervalSeconds", numberValue(event.target.value))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="timeoutMs">超时（毫秒）</FieldLabel>
            <Input
              id="timeoutMs"
              type="number"
              min={1000}
              max={30000}
              value={form.timeoutMs}
              onChange={(event) =>
                setField("timeoutMs", numberValue(event.target.value))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="failureThreshold">失败阈值</FieldLabel>
            <Input
              id="failureThreshold"
              type="number"
              min={1}
              max={5}
              value={form.failureThreshold}
              onChange={(event) =>
                setField("failureThreshold", numberValue(event.target.value))
              }
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="latencyThresholdMs">
            性能下降阈值（毫秒，可选）
          </FieldLabel>
          <Input
            id="latencyThresholdMs"
            type="number"
            min={100}
            max={60000}
            value={form.latencyThresholdMs ?? ""}
            onChange={(event) =>
              setField(
                "latencyThresholdMs",
                event.target.value ? numberValue(event.target.value) : null
              )
            }
          />
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="enabled"
            checked={form.enabled}
            onCheckedChange={(value) => setField("enabled", value)}
          />
          <FieldLabel htmlFor="enabled">创建后立即启用</FieldLabel>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "正在保存" : submitLabel}
      </Button>
    </form>
  )
}
