INSERT INTO
    "tp_status" (
        id,
        color_code,
        description,
        name
    )
VALUES (
        16,
        '#000000',
        'Trust Score Greater than 50',
        'Greater than 50'
    ),
    (
        17,
        '#000000',
        'Trust Score Greater than 100',
        'Greater than 100'
    ),
    (
        18,
        '#000000',
        'AI Recommendation',
        'AI Recommendation'
    ) ON CONFLICT (id) DO NOTHING;