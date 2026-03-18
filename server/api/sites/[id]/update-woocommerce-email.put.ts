import { prisma } from '#server/utils/db'
import {
  ensureWpCliOnServer,
  getSiteInstallationContext,
  runWpCliCommand,
  toPhpStringLiteral
} from '#server/utils/siteWpCli'
import { requireEmail, requireSiteId } from '#server/utils/siteUserInput'

type Body = {
  email?: string
  fromName?: string
}

/**
 * WooCommerce email notification option keys that have a `recipient` field
 * which defaults to the site admin email. Updating these ensures all
 * admin-facing notification mails go to the new address.
 */
const WOO_ADMIN_EMAIL_OPTIONS = [
  'woocommerce_new_order_settings',
  'woocommerce_cancelled_order_settings',
  'woocommerce_failed_order_settings'
]

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const body = await readBody<Body>(event)
  const email = requireEmail(body?.email)
  const fromName = (body?.fromName || '').trim() || null

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  await ensureWpCliOnServer(installation.serverId)

  // Update the "from" email address for all WooCommerce outgoing emails
  await runWpCliCommand(installation, [
    'option',
    'update',
    'woocommerce_email_from_address',
    email
  ])

  // Update the "from" name for WooCommerce emails
  if (fromName) {
    await runWpCliCommand(installation, [
      'option',
      'update',
      'woocommerce_email_from_name',
      fromName
    ])
  }

  // Update recipient on each admin notification email type
  const emailLiteral = toPhpStringLiteral(email)
  for (const optionKey of WOO_ADMIN_EMAIL_OPTIONS) {
    const phpCode = [
      `$o = get_option(${toPhpStringLiteral(optionKey)}, []);`,
      `if (is_array($o)) {`,
      `  $o['recipient'] = ${emailLiteral};`,
      `  update_option(${toPhpStringLiteral(optionKey)}, $o);`,
      `}`
    ].join(' ')

    await runWpCliCommand(installation, ['eval', phpCode], { allowFailure: true })
  }

  await prisma.wordPressInstallation.update({
    where: { id: installationId },
    data: {
      wooCommerceEmail: email,
      wooCommerceEmailFromName: fromName
    }
  })

  return { wooCommerceEmail: email, wooCommerceEmailFromName: fromName }
})
