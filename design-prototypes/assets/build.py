#!/usr/bin/env python3
"""Builds design-prototypes/*.html pages by injecting the shared icon sprite,
runtime script and the (role-specific) sidebar/topbar shell.

Pages author only the <main> content and declare meta in a JSON sidecar block:
    <!--META {"file":"03-admin-overview.html","title":"概览","sub":"...","active":"overview","theme":"light"} -->
The builder replaces <!--#SHELL#--> with sidebar + topbar derived from META.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = (ROOT / 'assets/icons.svg.html').read_text()
RUNTIME = (ROOT / 'assets/runtime.js.html').read_text()

USER_NAV = [
    ('group', '工作', [
        ('workbench', 'grid', '工作台', ''),
        ('keys', 'key', 'API 密钥', '6'),
        ('usage', 'chart', '使用记录', ''),
        ('batch', 'sparkles', '批量生图', ''),
    ]),
    ('group', '服务', [
        ('channels', 'layers', '可用渠道', ''),
        ('status', 'signal', '渠道状态', '<span class="pill pill-ok" style="height:18px">99.4%</span>'),
        ('subs', 'creditCard', '我的订阅', ''),
    ]),
    ('group', '账务', [
        ('pay', 'dollar', '充值 / 订阅', ''),
        ('orders', 'orderList', '我的订单', ''),
        ('redeem', 'gift', '兑换', ''),
        ('aff', 'users', '邀请返利', ''),
    ]),
    ('group', '', [('profile', 'user', '个人资料', '')]),
]

ADMIN_NAV = [
    ('group', '总览', [
        ('overview', 'grid', '概览', ''),
        ('ops', 'activity', '运维监控', '<span class="pill pill-warn" style="height:18px">3</span>'),
    ]),
    ('group', '流量', [
        ('accounts', 'server', '账号池', '248'),
        ('groups', 'layers', '分组与定价', ''),
        ('channels', 'cpu', '渠道定价', ''),
        ('monitor', 'signal', '渠道监控', ''),
    ]),
    ('group', '客户', [
        ('users', 'users', '用户', ''),
        ('subs', 'creditCard', '订阅', ''),
        ('orders', 'orderList', '订单', '<span class="cnt">12</span>'),
        ('billing', 'dollar', '支付配置', ''),
        ('redeem', 'ticket', '兑换码 / 优惠码', ''),
        ('aff', 'userPlus', '邀请返利', ''),
    ]),
    ('group', '系统', [
        ('risk', 'shield', '安全审计', ''),
        ('audit', 'clipboard', '操作日志', ''),
        ('plugins', 'plug', '插件', ''),
        ('settings', 'cog', '系统设置', ''),
    ]),
]

MINE = [
    ('group', '我的账户', [
        ('keys', 'key', 'API 密钥', ''),
        ('usage', 'chart', '使用记录', ''),
        ('subs', 'creditCard', '我的订阅', ''),
        ('profile', 'user', '个人资料', ''),
    ]),
]


def render_sidebar(active, role):
    if role == 'admin':
        nav = ADMIN_NAV + MINE
    else:
        nav = USER_NAV
    out = []
    for kind, label, items in nav:
        out.append('<div class="sb-group">')
        if label:
            out.append(f'<div class="sb-group-t">{label}</div>')
        for key, icon, text, tail in items:
            on = ' on' if key == active else ''
            tail_html = f'<span class="tail">{tail}</span>' if tail else ''
            out.append(f'<a class="sb-item{on}"><svg class="i"><use href="#i-{icon}"/></svg>{text}{tail_html}</a>')
        out.append('</div>')
    return '\n'.join(out)


def render_shell(meta):
    role = meta.get('role', 'user')
    if role == 'admin':
        brand_ver = 'v1.4.2 <span class="sb-ver" style="margin-left:6px">ADMIN</span>'
        balance = '<div class="tb-icon"><svg class="i"><use href="#i-filter"/></svg></div><div class="tb-icon"><svg class="i"><use href="#i-globe"/></svg></div>'
        user = ('<div class="user-chip"><div class="avatar" style="background:linear-gradient(135deg,#334155,#0f172a)">AD</div>'
                '<div class="stack"><span class="nm">系统管理员</span><span class="rl">admin@sub2api.dev</span></div>'
                '<svg class="i i-16 muted"><use href="#i-chevronDown"/></svg></div>')
    else:
        brand_ver = 'v1.4.2 <span class="xs muted" style="margin-left:6px">Forge</span>'
        balance = '<div class="balance-pill"><svg class="i i-16"><use href="#i-dollar"/></svg>$312.86</div>'
        user = ('<div class="user-chip"><div class="avatar">LY</div>'
                '<div class="stack"><span class="nm">林岩</span><span class="rl">订阅用户</span></div>'
                '<svg class="i i-16 muted"><use href="#i-chevronDown"/></svg></div>')
    return f'''
<aside class="sidebar">
  <div class="sb-brand">
    <div class="sb-logo">S2</div>
    <div class="stack">
      <div class="sb-name">Sub2API</div>
      <div class="row gap-6">{brand_ver}</div>
    </div>
  </div>
  <nav class="sb-scroll">
{render_sidebar(meta.get("active"), role)}
  </nav>
  <div class="sb-foot">
    <div class="usage-meter">
      <div class="row" style="justify-content:space-between"><span class="xs bold">本月额度</span><span class="xs muted">72%</span></div>
      <div class="progress"><i style="width:72%"></i></div>
      <div class="xs muted">已用 $218.40 / $300.00</div>
    </div>
    <a class="sb-item" data-toggle-theme><svg class="i"><use href="#i-moon"/></svg><span>深色模式</span></a>
    <a class="sb-item"><svg class="i"><use href="#i-chevronLeft"/></svg>收起侧栏</a>
  </div>
</aside>

<div class="main">
  <header class="topbar">
    <div class="tb-title"><h1>{meta["title"]}</h1><span>{meta["sub"]}</span></div>
    <div class="tb-search"><svg class="i i-16"><use href="#i-search"/></svg><span class="grow">全局搜索：用户 / 账号 / 订单…</span><span class="kbd">⌘K</span></div>
    <div class="tb-right">
      <div class="tb-icon"><svg class="i"><use href="#i-bell"/></svg><span class="badge-dot"></span></div>
      {balance}
      {user}
    </div>
  </header>
'''


def build(path):
    src = path.read_text()
    m = re.search(r'<!--META (\{.*?\}) -->', src, re.S)
    meta = json.loads(m.group(1)) if m else {}
    body = src.replace(m.group(0), '') if m else src
    if '<!--#SHELL#-->' in body:
        body = body.replace('<!--#SHELL#-->', render_shell(meta))
    body = body.replace('<!--#INCLUDE icons#-->', ICONS)
    body = body.replace('<!--#INCLUDE runtime#-->', RUNTIME)
    out = ROOT / path.name
    out.write_text(body)
    return out


if __name__ == '__main__':
    targets = sys.argv[1:] or [p.name for p in sorted((ROOT / 'src' / 'pages').glob('*.html'))]
    for t in targets:
        print('built', build(ROOT / 'src' / 'pages' / t))
