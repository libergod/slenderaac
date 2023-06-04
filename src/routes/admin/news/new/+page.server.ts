import { type Actions, fail, redirect } from '@sveltejs/kit';
import invariant from 'tiny-invariant';

import { prisma } from '$lib/server/prisma';
import {
	presenceValidator,
	stringValidator,
	validate,
} from '$lib/server/validations';

import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
	if (!locals.accountId) {
		throw redirect(302, '/login');
	}
	const author = await prisma.players.findFirst({
		where: {
			account_id: locals.accountId,
			is_main: true,
		},
		select: {
			name: true,
		},
	});

	if (!author) {
		return fail(400, {
			invalid: true,
			errors: { global: ['No main character found'] } as Record<
				string,
				string[]
			>,
		});
	}

	return { author };
}) satisfies PageServerLoad;

export const actions = {
	default: async ({ locals, request }) => {
		if (!locals.accountId) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const title = data.get('title');
		const content = data.get('content');
		const published = data.get('published');

		const errors = validate(
			{
				title: [presenceValidator, stringValidator],
				content: [presenceValidator, stringValidator],
			},
			data,
		);

		if (Object.keys(errors).length > 0) {
			return fail(400, { invalid: true, errors: errors });
		}

		invariant(title && content, 'Missing required fields');
		invariant(typeof title === 'string', 'Name must be a string');
		invariant(typeof content === 'string', 'Name must be a string');

		const author = await prisma.players.findFirst({
			where: {
				account_id: locals.accountId,
				is_main: true,
			},
		});

		if (!author) {
			return fail(400, {
				invalid: true,
				errors: { global: ['No main character found'] } as Record<
					string,
					string[]
				>,
			});
		}

		try {
			await prisma.news.create({
				data: {
					title,
					content,
					published_at: Date.now(),
					published: published === 'on',
					author_id: author.id,
				},
			});
		} catch (e) {
			console.error(e);
			return fail(500, {
				errors: { global: ['Failed to create news article'] } as Record<
					string,
					string[]
				>,
			});
		}

		throw redirect(302, '/admin/news');
	},
} satisfies Actions;