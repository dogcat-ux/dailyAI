import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>生活回顾</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>收支概览</Text>
        <View style={styles.card}>
          <Text style={styles.placeholder}>暂无账单记录，去聊天室记一笔吧</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>心情波动</Text>
        <View style={styles.card}>
          <Text style={styles.placeholder}>暂无日记记录，记录今天的心情吧</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#666',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#999',
    textAlign: 'center',
  },
});
