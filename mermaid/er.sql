with cte_keys as (
  SELECT tab1.name AS [table], 
    col1.name AS [column],
    tab2.name AS [referenced_table], 
    col2.name AS [referenced_column]
  FROM sys.foreign_key_columns fkc
  JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id
  JOIN sys.tables tab1 ON tab1.object_id = fkc.parent_object_id
  JOIN sys.schemas sch ON tab1.schema_id = sch.schema_id
  JOIN sys.columns col1 ON col1.column_id = parent_column_id AND col1.object_id = tab1.object_id
  JOIN sys.tables tab2 ON tab2.object_id = fkc.referenced_object_id
  JOIN sys.columns col2 ON col2.column_id = referenced_column_id AND col2.object_id = tab2.object_id
)
SELECT DISTINCT '  {"key": "' + TABLE_NAME + '", "value": "' + TABLE_NAME + ' <|-- ' +  cte_keys.referenced_table + ' : has" },' as erDiagram
FROM INFORMATION_SCHEMA.COLUMNS
JOIN cte_keys on cte_keys.[table] = INFORMATION_SCHEMA.COLUMNS.TABLE_NAME and cte_keys.[column] = COLUMN_NAME
UNION SELECT '  {"key": "' + t.name + '", "value": "class ' + t.name + '{\n ' + STUFF(
(
  SELECT '   ' + st1.DATA_TYPE + CASE 
		WHEN st1.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
	  THEN CASE WHEN st1.CHARACTER_MAXIMUM_LENGTH > 0
		  THEN '_' + CAST(st1.CHARACTER_MAXIMUM_LENGTH as NVARCHAR)
		  ELSE '_MAX'
		  END
	  ELSE '' 
	  END  + ' ' + st1.COLUMN_NAME + '\n' AS [text()]
  FROM INFORMATION_SCHEMA.COLUMNS ST1
  WHERE ST1.TABLE_NAME = t.NAME
  ORDER BY ST1.TABLE_NAME
  FOR XML PATH (''), TYPE
).value('text()[1]','nvarchar(max)'), 1, 1, '') + '  }" },' [Cols]
FROM sys.tables t
